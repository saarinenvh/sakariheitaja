import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { NotableScoreKind } from "../policy";

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

/** A player's round, which their special scores are saved under. */
export interface PlayerRound {
  playerId: number;
  chatId: number;
  competitionId: number;
}

/** A special score on one hole of the card. */
export interface SpecialScore {
  holeNumber: number;
  kind: NotableScoreKind;
}

/** Special scores to save, with the course and date their rows get. */
export interface SpecialScoreRows {
  courseId: number;
  date: string;
  scores: readonly SpecialScore[];
}

interface SqlRunner {
  query(sql: string, parameters: unknown[]): Promise<{ affectedRows: number }>;
}

const SPECIAL_SCORE_TABLES: Record<NotableScoreKind, string> = { ace: "aces", eagle: "eagles", albatross: "albatrosses" };

/** Adds these special scores; one that is already saved for its hole is left as it is. */
export async function addSpecialScores(round: PlayerRound, rows: SpecialScoreRows): Promise<void> {
  await insertSpecialScores(dataSource, round, rows);
}

/**
 * Replaces the player's special scores in the round with these (none when null), in one
 * transaction. This also removes the round's rows saved before holes were recorded.
 */
export async function rebuildSpecialScores(round: PlayerRound, rows: SpecialScoreRows | null): Promise<void> {
  await dataSource.transaction(async manager => {
    for (const table of Object.values(SPECIAL_SCORE_TABLES)) {
      await manager.query(`DELETE FROM ${table} WHERE competition_id = ? AND player_id = ?`, [round.competitionId, round.playerId]);
    }

    if (rows) await insertSpecialScores(manager, round, rows);
  });

  log.info({ playerId: round.playerId, competitionId: round.competitionId, saved: rows?.scores.length ?? 0 }, "special scores rebuilt");
}

async function insertSpecialScores(runner: SqlRunner, round: PlayerRound, rows: SpecialScoreRows): Promise<void> {
  for (const score of rows.scores) {
    const result = await runner.query(
      `INSERT IGNORE INTO ${SPECIAL_SCORE_TABLES[score.kind]} (date, player_id, chat_id, course_id, competition_id, hole_number) VALUES (?, ?, ?, ?, ?, ?)`,
      [rows.date, round.playerId, round.chatId, rows.courseId, round.competitionId, score.holeNumber],
    );
    if (result.affectedRows > 0) log.info({ playerId: round.playerId, kind: score.kind, holeNumber: score.holeNumber }, "special score added");
  }
}
