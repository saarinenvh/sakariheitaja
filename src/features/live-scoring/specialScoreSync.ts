import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { withWriteRetry } from "../../db/writeRetry";
import * as scoreService from "../score-records";

/** The followed round, as its special-score rows name it. */
export interface FollowedCompetition {
  id: number;
  chatId: number;
}

/**
 * Makes each tracked player's saved special scores what their card says. Safe to repeat: a sync that
 * fails is made good by the next one. Throws at the first player that still fails after the retries.
 */
export async function syncRoundSpecialScores(
  competition: FollowedCompetition, round: MetrixRound, tracked: readonly TrackedRoundPlayer[],
): Promise<void> {
  const played = { courseName: round.courseName, day: round.day };
  const now = new Date();

  for (const { id: playerId, player } of tracked) {
    const playerRound = { playerId, chatId: competition.chatId, competitionId: competition.id };
    await withWriteRetry("sync special scores", () => scoreService.syncSpecialScores(playerRound, played, player.scorecard, now));
  }
}
