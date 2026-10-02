import { ChatMessenger } from "../chatMessenger";
import { competition as MSG } from "../../config/messages";
import { selectFinalScores, selectRankedResults, selectTrackedRankedResults } from "../../integrations/metrix/round/results";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { computeAndApplySwaps, formatBagtagAnnouncement, selectBagtagParticipants } from "../disc-golf/scores/bagtags";
import { updateProfiles } from "../disc-golf/scores/playerProfiles";
import * as competitionService from "../disc-golf/services/CompetitionService";
import * as courseService from "../disc-golf/services/CourseService";
import * as scoreService from "../disc-golf/services/ScoreService";

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
 */
export async function finishRound(end: RoundEnd, round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): Promise<void> {
  const { chatId, competitionId, messenger } = end;
  await messenger.sendText(chatId, MSG.endSoon);
  const course = await courseService.getOrCreate(round.courseName);
  if (course) await scoreService.saveResults(selectFinalScores(tracked), chatId, course.id, competitionId);
  updateProfiles(chatId, competitionId, selectTrackedRankedResults(tracked), selectRankedResults(round.players));
  const bagtags = computeAndApplySwaps(chatId, selectBagtagParticipants(tracked));
  await competitionService.markDone(competitionId);
  await end.sendTopList();
  await messenger.sendHtml(chatId, formatBagtagAnnouncement(bagtags));
}
