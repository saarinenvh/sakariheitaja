import { moduleLogger } from "../../shared/logger";
import { dataSource } from "../../db/dataSource";
import { Competition } from "./Competition.entity";

const log = moduleLogger("competitions");

function repo() {
  return dataSource.getRepository(Competition);
}

export async function findUnfinished(): Promise<Competition[]> {
  return repo().findBy({ finished: false });
}

export async function findByChatId(chatId: number): Promise<Competition[]> {
  return repo().findBy({ chatId, finished: false });
}

export async function create(chatId: number, metrixId: string): Promise<{ insertId: number }> {
  const result = await dataSource.query(
    "INSERT INTO competitions (finished, chat_id, metrix_id) VALUES (false, ?, ?)",
    [chatId, metrixId]
  );
  return { insertId: result.insertId as number };
}

export async function deleteById(id: number): Promise<void> {
  await repo().delete(id);
  log.info({ competitionId: id }, "competition removed");
}

export async function markFinished(id: number): Promise<void> {
  await repo().update(id, { finished: true });
}
