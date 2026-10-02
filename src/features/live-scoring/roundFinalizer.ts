import { ChatMessenger } from "../chatMessenger";
import { liveScoringMessages as MSG } from "./messages";
import { selectFinalScores, selectRankedResults, selectTrackedRankedResults } from "../../integrations/metrix/round/results";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { computeAndApplySwaps, formatBagtagAnnouncement, selectBagtagParticipants } from "../bagtags/bagtags";
import { updateProfiles } from "../player-profiles/playerProfiles";
import * as competitionService from "./competitions";
import * as courseService from "../score-records/courses";
import * as scoreService from "../score-records/scoreRecords";

export interface RoundEnd {
  chatId: number;
  competitionId: number;
  messenger: ChatMessenger;
  /** Posts the round's TOP-5; the same list `/top5` shows. */
  sendTopList(): Promise<void>;
}

/**
 * Finishes a round once every tracked player is done: the end message, then results, profiles and bagtags,
 * then the competition marked done, then the TOP-5 and the bagtag announcement.
 * The competition is marked done only after everything is saved: if a step fails, the round stays unfinished
 * and the round end runs again when the bot restarts. Every step before that is safe to repeat.
 * The TOP-5 and bagtag messages after it are best effort: a failed send is logged, not retried, and the
 * saved results stay available through /tulokset and /bagtag.
 */
export async function finishRound(end: RoundEnd, round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): Promise<void> {
  const { chatId, competitionId, messenger } = end;
  await messenger.sendText(chatId, MSG.endSoon);
  const course = await courseService.getOrCreate(round.courseName);
  if (!course) throw new Error(`Course ${round.courseName} could not be saved`);
  await scoreService.saveResults(selectFinalScores(tracked), chatId, course.id, competitionId);
  updateProfiles(chatId, competitionId, selectTrackedRankedResults(tracked), selectRankedResults(round.players));
  const bagtags = computeAndApplySwaps(chatId, selectBagtagParticipants(tracked));
  await competitionService.markDone(competitionId);
  await end.sendTopList();
  await messenger.sendHtml(chatId, formatBagtagAnnouncement(bagtags));
}
