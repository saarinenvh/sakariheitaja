import { moduleLogger } from "../../shared/logger";
import { dataSource } from "../dataSource";
import { Chat } from "../entities/Chat";

const log = moduleLogger("chats");

function repo() {
  return dataSource.getRepository(Chat);
}

export async function findById(id: number): Promise<Chat | null> {
  return repo().findOneBy({ id });
}

export async function addIfAbsent(chatId: number, name: string): Promise<void> {
  const existing = await findById(chatId);
  if (existing) return;
  await dataSource.query(
    "INSERT INTO chats (id, name) VALUES (?, ?)",
    [chatId, name]
  );
  log.info({ chatId, name }, "added new chat");
}
