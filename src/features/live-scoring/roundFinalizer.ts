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
 * Finishes a round once every tracked player is done, in this order: the end message, the competition marked
 * done, results saved, profiles updated, bagtags swapped, then the TOP-5 and the bagtag announcement.
 */
export async function finishRound(end: RoundEnd, round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): Promise<void> {
  const { chatId, competitionId, messenger } = end;
  await messenger.sendText(chatId, MSG.endSoon);
  await competitionService.markDone(competitionId);
  const course = await courseService.getOrCreate(round.courseName);
  if (course) await scoreService.saveResults(selectFinalScores(tracked), chatId, course.id, competitionId);
  updateProfiles(chatId, selectTrackedRankedResults(tracked), selectRankedResults(round.players));
  const bagtags = computeAndApplySwaps(chatId, selectBagtagParticipants(tracked));
  await end.sendTopList();
  await messenger.sendHtml(chatId, formatBagtagAnnouncement(bagtags));
}
