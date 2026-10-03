import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";

const log = moduleLogger("scores");

export interface ScoreRow {
  courseId: number;
  player: string;
  course: string;
  sum: number;
  diff: number;
  count?: number;
}

export async function addResult(
  playerId: number,
  chatId: number,
  courseId: number,
  competitionId: number,
  diff: number,
  sum: number
): Promise<void> {
  await dataSource.query(
    "INSERT INTO scores (player_id, chat_id, course_id, competition_id, diff, sum) VALUES (?, ?, ?, ?, ?, ?)",
    [playerId, chatId, courseId, competitionId, diff, sum]
  );
  log.info({ playerId }, "score added");
}

/** Players whose result for the competition is already saved. */
export async function findResultPlayerIds(competitionId: number): Promise<number[]> {
  const rows: { playerId: number }[] = await dataSource.query(
    "SELECT player_id AS playerId FROM scores WHERE competition_id = ?",
    [competitionId]
  );
  return rows.map(row => row.playerId);
}

export async function findByCourseName(name: string, chatId: number): Promise<ScoreRow[]> {
  const rows = await dataSource.query(
    `SELECT S.course_id AS courseId, I.name AS player, C.name AS course, S.sum, S.diff,
      (SELECT COUNT(DISTINCT S2.course_id) FROM scores S2 JOIN courses C2 ON S2.course_id = C2.id
       WHERE S2.chat_id = ? AND C2.name LIKE ?) AS count
     FROM scores S
     JOIN players I ON S.player_id = I.id
     JOIN courses C ON S.course_id = C.id
     WHERE S.chat_id = ? AND C.name LIKE ?
     ORDER BY S.diff`,
    [chatId, `%${name}%`, chatId, `%${name}%`]
  );
  return rows.map((row: any) => ({ ...row, count: Number(row.count) }));
}

export async function findByCourseId(id: string | number, chatId: number): Promise<ScoreRow[]> {
  return dataSource.query(
    `SELECT S.course_id AS courseId, I.name AS player, C.name AS course, S.sum, S.diff
     FROM scores S
     JOIN courses C ON S.course_id = C.id
     JOIN players I ON S.player_id = I.id
     WHERE S.chat_id = ? AND C.id = ?
     ORDER BY S.diff`,
    [chatId, id]
  );
}

export async function addAce(date: string, playerId: number, chatId: number, courseId: number, competitionId: number): Promise<void> {
  await dataSource.query(
    "INSERT INTO aces (date, player_id, chat_id, course_id, competition_id) VALUES (?, ?, ?, ?, ?)",
    [date, playerId, chatId, courseId, competitionId]
  );
  log.info({ playerId }, "ace added");
}

export async function addEagle(date: string, playerId: number, chatId: number, courseId: number, competitionId: number): Promise<void> {
  await dataSource.query(
    "INSERT INTO eagles (date, player_id, chat_id, course_id, competition_id) VALUES (?, ?, ?, ?, ?)",
    [date, playerId, chatId, courseId, competitionId]
  );
  log.info({ playerId }, "eagle added");
}

export async function addAlbatross(date: string, playerId: number, chatId: number, courseId: number, competitionId: number): Promise<void> {
  await dataSource.query(
    "INSERT INTO albatrosses (date, player_id, chat_id, course_id, competition_id) VALUES (?, ?, ?, ?, ?)",
    [date, playerId, chatId, courseId, competitionId]
  );
  log.info({ playerId }, "albatross added");
}
