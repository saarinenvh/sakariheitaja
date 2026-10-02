import { FinalScore } from "../../../integrations/metrix/round/results";
import { ScoreRow } from "../../../db/repositories/ScoreRepository";
import * as scoreRepo from "../../../db/repositories/ScoreRepository";
import * as courseRepo from "../../../db/repositories/CourseRepository";
import { ScoreChange } from "../commentary/detect/scorecardChanges";

export async function saveRecordedScores(
  playerId: number, changes: readonly ScoreChange[], chatId: number, competitionId: number, courseName: string,
): Promise<void> {
  const notable = changes.filter(change => change.kind === "recorded"
    && (change.score.strokes === 1 || change.score.relativeToPar === -2 || change.score.relativeToPar === -3));
  if (notable.length === 0) return;
  const course = await courseRepo.findByName(courseName);
  if (!course) return;
  const date = new Date().toISOString().slice(0, 10);
  for (const change of notable) {
    if (change.kind !== "recorded") continue;
    if (change.score.strokes === 1) await scoreRepo.addAce(date, playerId, chatId, course.id, competitionId);
    else if (change.score.relativeToPar === -3) await scoreRepo.addAlbatross(date, playerId, chatId, course.id, competitionId);
    else await scoreRepo.addEagle(date, playerId, chatId, course.id, competitionId);
  }
}

export async function saveResults(
  scores: readonly FinalScore[],
  chatId: number,
  courseId: number,
  competitionId: number
): Promise<void> {
  for (const score of scores) {
    await scoreRepo.addResult(score.playerId, chatId, courseId, competitionId, score.relativeToPar, score.strokes);
  }
}

export async function getByCourseName(name: string, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseName(name, chatId);
}

export async function getByCourseId(id: string | number, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseId(id, chatId);
}
