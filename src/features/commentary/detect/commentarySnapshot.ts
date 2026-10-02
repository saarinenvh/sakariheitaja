import { MetrixRound, TrackedRoundPlayer } from "../../../integrations/metrix/round/types";
import { CommentarySnapshot } from "../facts/playerBrief";

/** What commentary remembers of one tracked player after an observation. */
export function buildCommentarySnapshot(round: MetrixRound, tracked: TrackedRoundPlayer, chatId: number): CommentarySnapshot {
  const { id, player } = tracked;
  return {
    scope: { chatId, competitionId: round.id, division: player.division, playerId: id },
    playerName: player.name, courseName: round.courseName, holeLabels: round.holeLabels,
    scorecard: player.scorecard, round: player.round, standing: player.standing,
  };
}
