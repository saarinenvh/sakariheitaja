import { FinalScore } from "../../integrations/metrix/round/results";
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
    ? { courseId: await findOrAddCourseId(played.courseName), date: specialScoreDate(played.day, new Date()), scores }
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
  await courseRepo.addIfAbsent(name);
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

    await scoreRepo.addResult({
      playerId: score.playerId, chatId, courseId, competitionId, relativeToPar: score.relativeToPar, strokes: score.strokes,
    });
    saved.add(score.playerId);
  }
}

/**
 * - `results`: the course's results in the chat, best first (none when it has no results here).
 * - `ambiguous-course`: several of the chat's courses match the name; the caller asks which, by id.
 * - `not-found`: no course with that id, or none of the chat's courses matches the name.
 */
export type CourseResultsReport =
  | { kind: "results"; course: string; results: scoreRepo.CourseResult[] }
  | { kind: "ambiguous-course"; courses: { id: number; name: string }[] }
  | { kind: "not-found" };

/** `/tulokset`: a number is a course id; text is searched from the names of the chat's courses with results. */
export async function findCourseResults(chatId: number, query: string): Promise<CourseResultsReport> {
  const course = await resolveResultCourse(chatId, query);
  if (course.kind !== "course") return course;

  return { kind: "results", course: course.name, results: await scoreRepo.findCourseResults(chatId, course.id) };
}

async function resolveResultCourse(
  chatId: number, query: string,
): Promise<{ kind: "course"; id: number; name: string } | Exclude<CourseResultsReport, { kind: "results" }>> {
  if (/^\d+$/.test(query)) {
    const course = await courseRepo.findById(Number(query));
    return course ? { kind: "course", id: course.id, name: course.name } : { kind: "not-found" };
  }

  const courses = await scoreRepo.findCoursesWithResults(chatId, query);
  if (courses.length === 0) return { kind: "not-found" };
  if (courses.length > 1) return { kind: "ambiguous-course", courses: courses.map(({ id, name }) => ({ id, name })) };

  return { kind: "course", id: courses[0].id, name: courses[0].name };
}
