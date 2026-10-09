import { IsNull } from "typeorm";
import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { Competition, COMPETITION_STATUS } from "./Competition.entity";

const log = moduleLogger("competitions");

/** The longest error reason the table keeps. */
const ERROR_REASON_MAX_LENGTH = 255;

/** A followed round, as resuming it needs. */
export interface FollowedRound {
  id: number;
  chatId: number;
  metrixId: string;
}

/** A round given up on, for manual handling. */
export interface ErroredRound extends FollowedRound {
  erroredAt: Date | null;
  errorReason: string | null;
}

function repo() {
  return dataSource.getRepository(Competition);
}

/** The oldest first, so of two rows for the same round the first one followed wins. */
export async function findFollowing(): Promise<FollowedRound[]> {
  const following = await repo().find({ where: { status: COMPETITION_STATUS.following }, order: { id: "ASC" } });

  return following.map(({ id, chatId, metrixId }) => ({ id, chatId, metrixId }));
}

/** Rounds given up on, the latest first. */
export async function findErrored(): Promise<ErroredRound[]> {
  const errored = await repo().find({ where: { status: COMPETITION_STATUS.error }, order: { erroredAt: "DESC" } });

  return errored.map(({ id, chatId, metrixId, erroredAt, errorReason }) => ({ id, chatId, metrixId, erroredAt, errorReason }));
}

export async function create(chatId: number, metrixId: string): Promise<{ insertId: number }> {
  const result = await repo().insert({ chatId, metrixId, status: COMPETITION_STATUS.following });

  return { insertId: result.identifiers[0].id as number };
}

/** Saves the round's day once Metrix has told it; a day already saved is kept. */
export async function saveDay(id: number, day: string): Promise<void> {
  await repo().update({ id, day: IsNull() }, { day });
}

export async function deleteById(id: number): Promise<void> {
  await repo().delete(id);
  log.info({ competitionId: id }, "competition removed");
}

/** Stops following the round (`/lopeta`); its special scores stay. */
export async function markStopped(id: number): Promise<void> {
  await repo().update(id, { status: COMPETITION_STATUS.stopped });
  log.info({ competitionId: id }, "competition stopped");
}

export async function markFinished(id: number): Promise<void> {
  await repo().update(id, { status: COMPETITION_STATUS.finished });
}

/** Gives up on a round: it isn't resumed again and stays for manual handling. */
export async function markError(id: number, reason: string, erroredAt: Date): Promise<void> {
  await repo().update(id, {
    status: COMPETITION_STATUS.error, erroredAt, errorReason: reason.slice(0, ERROR_REASON_MAX_LENGTH),
  });
  log.warn({ competitionId: id, reason }, "competition marked as error");
}
