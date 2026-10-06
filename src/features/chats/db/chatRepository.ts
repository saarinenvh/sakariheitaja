import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { Chat } from "./Chat.entity";

const log = moduleLogger("chats");

function repo() {
  return dataSource.getRepository(Chat);
}

export async function findById(id: number): Promise<Chat | null> {
  return repo().findOneBy({ id });
}

/** Stores the chat the first time the bot sees it; a chat already stored is left as it is. */
export async function addIfAbsent(chatId: number, name: string): Promise<void> {
  if (await repo().existsBy({ id: chatId })) return;

  await repo().createQueryBuilder().insert().into(Chat).values({ id: chatId, name }).orIgnore().execute();

  log.info({ chatId, name }, "added new chat");
}
