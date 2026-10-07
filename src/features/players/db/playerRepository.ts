import { dataSource } from "../../../db/dataSource";
import { insertedRow } from "../../../db/insertResult";
import { Player } from "./Player.entity";
import { PlayerChat } from "./PlayerChat.entity";

function players() {
  return dataSource.getRepository(Player);
}

function links() {
  return dataSource.getRepository(PlayerChat);
}

export async function findByName(name: string): Promise<Player | null> {
  return players().findOneBy({ name });
}

/** The players the chat follows. */
export async function findByChatId(chatId: number): Promise<Player[]> {
  return players()
    .createQueryBuilder("player")
    .innerJoin(PlayerChat, "link", "link.playerId = player.id")
    .where("link.chatId = :chatId", { chatId })
    .getMany();
}

/** Adds the player when no player has that name yet (names are unique, ignoring case). */
export async function addIfAbsent(name: string): Promise<void> {
  await players().createQueryBuilder().insert().into(Player).values({ name }).orIgnore().execute();
}

/** Links the player to the chat; false when they were linked already. */
export async function linkToChat(playerId: number, chatId: number): Promise<boolean> {
  const result = await links().createQueryBuilder().insert().into(PlayerChat).values({ playerId, chatId }).orIgnore().execute();

  return insertedRow(result);
}

/** Unlinks the player from the chat; false when they weren't linked. */
export async function unlinkFromChat(playerId: number, chatId: number): Promise<boolean> {
  const result = await links().delete({ playerId, chatId });

  return (result.affected ?? 0) > 0;
}
