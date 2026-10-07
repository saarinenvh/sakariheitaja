import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { Course } from "./Course.entity";
import { Score } from "./Score.entity";

const log = moduleLogger("scores");

/** A player's final result to save for a round. */
export interface NewResult {
  playerId: number;
  chatId: number;
  courseId: number;
  competitionId: number;
  relativeToPar: number;
  strokes: number;
}

/** A saved result as `/tulokset` lists it. */
export interface CourseResult {
  player: string;
  relativeToPar: number;
  strokes: number;
}

function scores() {
  return dataSource.getRepository(Score);
}

export async function addResult(result: NewResult): Promise<void> {
  const { playerId, chatId, courseId, competitionId, relativeToPar, strokes } = result;

  await scores().insert({ playerId, chatId, courseId, competitionId, diff: relativeToPar, sum: strokes });

  log.info({ playerId }, "score added");
}

/** Players whose result for the competition is already saved. */
export async function findResultPlayerIds(competitionId: number): Promise<number[]> {
  const saved = await scores().find({ select: { playerId: true }, where: { competitionId } });

  return saved.map(score => score.playerId);
}

/** The courses the chat has results on whose name contains the text, by name. */
export async function findCoursesWithResults(chatId: number, text: string): Promise<Course[]> {
  return dataSource.getRepository(Course)
    .createQueryBuilder("course")
    .innerJoin(Score, "score", "score.courseId = course.id")
    .where("score.chatId = :chatId", { chatId })
    .andWhere("course.name LIKE :pattern", { pattern: `%${text}%` })
    .distinct(true)
    .orderBy("course.name")
    .getMany();
}

/** The chat's results on the course, best first. */
export async function findCourseResults(chatId: number, courseId: number): Promise<CourseResult[]> {
  const saved = await scores().find({ where: { chatId, courseId }, relations: { player: true }, order: { diff: "ASC" } });

  return saved.map(score => ({ player: score.player.name, relativeToPar: score.diff, strokes: score.sum }));
}
