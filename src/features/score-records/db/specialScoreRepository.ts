import { EntityManager, FindOptionsWhere, MoreThanOrEqual } from "typeorm";
import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { insertedRowCount } from "../../../db/insertResult";
import { NotableScoreKind } from "../policy";
import { Ace, Albatross, Eagle, SpecialScoreRecord } from "./SpecialScore.entity";

const log = moduleLogger("special-scores");

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

/** A saved special score as the commands show it; `holeNumber` is null on rows saved before holes were. */
export interface SpecialScoreRow {
  player: string;
  course: string;
  holeNumber: number | null;
  date: string;
}

/** Which of a chat's special scores to read. */
export interface SpecialScoreFilter {
  sinceDate: string | null;
  courseId: number | null;
  playerId: number | null;
}

const SPECIAL_SCORE_ENTITIES: Record<NotableScoreKind, new () => SpecialScoreRecord> = { ace: Ace, eagle: Eagle, albatross: Albatross };

/**
 * Makes the player's saved special scores in this round these (none when null), in one transaction:
 * the round's rows for other holes go, including its rows saved before holes were recorded, and the
 * missing ones are added. Other rounds' rows are never touched. Rows that stay keep their id, and the
 * same rows again change nothing.
 */
export async function syncSpecialScores(round: PlayerRound, rows: SpecialScoreRows | null): Promise<void> {
  let changed = 0;

  await dataSource.transaction(async manager => {
    for (const [kind, entity] of Object.entries(SPECIAL_SCORE_ENTITIES)) {
      const holes = rows?.scores.filter(score => score.kind === kind).map(score => score.holeNumber) ?? [];

      changed += await deleteOtherHoles(manager, entity, round, holes);
      if (rows && holes.length > 0) changed += await insertHoles(manager, entity, round, rows, holes);
    }
  });

  if (changed > 0) log.info({ playerId: round.playerId, competitionId: round.competitionId, changed }, "special scores synced");
}

/** The chat's special scores of this kind that match the filter, newest first (by date, then by when they were saved). */
export async function findSpecialScores(
  kind: NotableScoreKind, chatId: number, filter: SpecialScoreFilter,
): Promise<SpecialScoreRow[]> {
  const where: FindOptionsWhere<SpecialScoreRecord> = { chatId };
  if (filter.sinceDate !== null) where.date = MoreThanOrEqual(filter.sinceDate);
  if (filter.courseId !== null) where.courseId = filter.courseId;
  if (filter.playerId !== null) where.playerId = filter.playerId;

  const records = await dataSource.getRepository(SPECIAL_SCORE_ENTITIES[kind]).find({
    where, relations: { player: true, course: true }, order: { date: "DESC", id: "DESC" },
  });

  return records.map(record => ({
    player: record.player.name, course: record.course.name, holeNumber: record.holeNumber, date: record.date,
  }));
}

/** The number of rows deleted: the player's rows in this round on any hole but these, or with no hole. */
async function deleteOtherHoles(
  manager: EntityManager, entity: new () => SpecialScoreRecord, round: PlayerRound, holes: readonly number[],
): Promise<number> {
  const query = manager.createQueryBuilder().delete().from(entity)
    .where("competition_id = :competitionId AND player_id = :playerId", round);
  if (holes.length > 0) query.andWhere("(hole_number IS NULL OR hole_number NOT IN (:...holes))", { holes });

  const result = await query.execute();
  return result.affected ?? 0;
}

/** The number of rows added. INSERT IGNORE: the unique (competition, player, hole) key leaves a saved hole alone. */
async function insertHoles(
  manager: EntityManager, entity: new () => SpecialScoreRecord, round: PlayerRound, rows: SpecialScoreRows, holes: readonly number[],
): Promise<number> {
  const values = holes.map(holeNumber => ({
    date: rows.date, playerId: round.playerId, chatId: round.chatId, courseId: rows.courseId,
    competitionId: round.competitionId, holeNumber,
  }));

  const result = await manager.createQueryBuilder().insert().into(entity).values(values).orIgnore().execute();
  return insertedRowCount(result);
}
