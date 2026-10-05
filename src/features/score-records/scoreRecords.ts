import { FinalScore } from "../../integrations/metrix/round/results";
import { ScoreRow } from "./db/scoreRepository";
import * as scoreRepo from "./db/scoreRepository";
import * as courseRepo from "./db/courseRepository";
import * as specialScoreRepo from "./db/specialScoreRepository";
import { PlayedRound, SpecialScoreUpdate } from "../commentary";
import { Course } from "./db/Course.entity";
import { specialScoreDate, specialScores } from "./policy";

/**
 * Updates a player's saved special scores: `add` adds the new holes' ones; `rebuild` replaces what
 * the round has saved for the player with the card's, so a corrected or removed score goes away.
 * Every row is dated with the round's date, so a rebuild on a later day keeps the scores' dates.
 */
export async function updateSpecialScores(
  round: specialScoreRepo.PlayerRound, played: PlayedRound, update: SpecialScoreUpdate,
): Promise<void> {
  const scores = specialScores(update.holes);
  const rows = scores.length > 0
    ? { courseId: await findOrAddCourseId(played.courseName), date: specialScoreDate(played.date, new Date()), scores }
    : null;

  if (update.kind === "rebuild") {
    await specialScoreRepo.rebuildSpecialScores(round, rows);
  } else if (rows) {
    await specialScoreRepo.addSpecialScores(round, rows);
  }
}

async function findOrAddCourseId(courseName: string): Promise<number> {
  const course = await getOrCreateCourse(courseName);
  if (!course) throw new Error(`Course "${courseName}" could not be created`);
  return course.id;
}

/** The course by name, added first when it is new; null if it still can't be read back. */
export async function getOrCreateCourse(name: string): Promise<Course | null> {
  await courseRepo.upsert(name);
  return courseRepo.findByName(name);
}

/** Saves each player's result once per competition, so a retried round end doesn't save twice. */
export async function saveResults(
  scores: readonly FinalScore[],
  chatId: number,
  courseId: number,
  competitionId: number
): Promise<void> {
  const saved = new Set(await scoreRepo.findResultPlayerIds(competitionId));
  for (const score of scores) {
    if (saved.has(score.playerId)) continue;
    await scoreRepo.addResult(score.playerId, chatId, courseId, competitionId, score.relativeToPar, score.strokes);
    saved.add(score.playerId);
  }
}

export async function getByCourseName(name: string, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseName(name, chatId);
}

export async function getByCourseId(id: string | number, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseId(id, chatId);
}
