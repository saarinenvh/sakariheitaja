import { EntityManager, FindOptionsWhere, MoreThanOrEqual } from "typeorm";
import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
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

/** Adds these special scores; one that is already saved for its hole is left as it is. */
export async function addSpecialScores(round: PlayerRound, rows: SpecialScoreRows): Promise<void> {
  await insertSpecialScores(dataSource.manager, round, rows);
}

/**
 * Replaces the player's special scores in the round with these (none when null), in one
 * transaction. This also removes the round's rows saved before holes were recorded.
 */
export async function rebuildSpecialScores(round: PlayerRound, rows: SpecialScoreRows | null): Promise<void> {
  await dataSource.transaction(async manager => {
    for (const entity of Object.values(SPECIAL_SCORE_ENTITIES)) {
      await manager.delete(entity, { competitionId: round.competitionId, playerId: round.playerId });
    }

    if (rows) await insertSpecialScores(manager, round, rows);
  });

  log.info({ playerId: round.playerId, competitionId: round.competitionId, saved: rows?.scores.length ?? 0 }, "special scores rebuilt");
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

/** INSERT IGNORE: the unique (competition, player, hole) key leaves an already saved hole alone. */
async function insertSpecialScores(manager: EntityManager, round: PlayerRound, rows: SpecialScoreRows): Promise<void> {
  for (const [kind, entity] of Object.entries(SPECIAL_SCORE_ENTITIES)) {
    const values = rows.scores.filter(score => score.kind === kind).map(score => ({
      date: rows.date, playerId: round.playerId, chatId: round.chatId, courseId: rows.courseId,
      competitionId: round.competitionId, holeNumber: score.holeNumber,
    }));
    if (values.length === 0) continue;

    await manager.createQueryBuilder().insert().into(entity).values(values).orIgnore().execute();
    log.info({ playerId: round.playerId, kind, holes: values.map(value => value.holeNumber) }, "special scores saved");
  }
}
