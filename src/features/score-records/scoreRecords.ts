import { FinalScore } from "../../integrations/metrix/round/results";
import { ScoreRow } from "./db/scoreRepository";
import * as scoreRepo from "./db/scoreRepository";
import * as courseRepo from "./db/courseRepository";
import { ScoreChange } from "../commentary/detect/scorecardChanges";
import { Course } from "./db/Course.entity";
import { NotableScoreKind, notableScoreKind } from "./policy";

type NotableScoreWriter = (date: string, playerId: number, chatId: number, courseId: number, competitionId: number) => Promise<void>;

const NOTABLE_SCORE_WRITERS: Record<NotableScoreKind, NotableScoreWriter> = {
  ace: (...row) => scoreRepo.addAce(...row),
  eagle: (...row) => scoreRepo.addEagle(...row),
  albatross: (...row) => scoreRepo.addAlbatross(...row),
};

export async function saveRecordedScores(
  playerId: number, changes: readonly ScoreChange[], chatId: number, competitionId: number, courseName: string,
): Promise<void> {
  const notable = changes.flatMap(change => {
    const kind = change.kind === "recorded" ? notableScoreKind(change.score) : null;
    return kind ? [kind] : [];
  });
  if (notable.length === 0) return;
  const course = await courseRepo.findByName(courseName);
  if (!course) return;
  const date = new Date().toISOString().slice(0, 10);
  for (const kind of notable) {
    await NOTABLE_SCORE_WRITERS[kind](date, playerId, chatId, course.id, competitionId);
  }
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
