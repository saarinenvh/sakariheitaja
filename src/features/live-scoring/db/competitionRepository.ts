import { IsNull, Not } from "typeorm";
import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { Competition } from "./Competition.entity";

const log = moduleLogger("competitions");

/** A followed round that can be resumed: it has a chat and a Metrix id. */
export interface FollowedRound {
  id: number;
  chatId: number;
  metrixId: string;
}

function repo() {
  return dataSource.getRepository(Competition);
}

/** Rounds not finished yet; a row without a chat or Metrix id can't be followed and is left out. */
export async function findUnfinished(): Promise<FollowedRound[]> {
  const unfinished = await repo().findBy({ finished: false, chatId: Not(IsNull()), metrixId: Not(IsNull()) });

  return unfinished.flatMap(({ id, chatId, metrixId }) => (chatId !== null && metrixId !== null ? [{ id, chatId, metrixId }] : []));
}

export async function create(chatId: number, metrixId: string): Promise<{ insertId: number }> {
  const result = await repo().insert({ chatId, metrixId, finished: false });

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

export async function markFinished(id: number): Promise<void> {
  await repo().update(id, { finished: true });
}
