import { dataSource } from "../../db/dataSource";
import { Player } from "./Player.entity";

function repo() {
  return dataSource.getRepository(Player);
}

export async function findAll(): Promise<Player[]> {
  return repo().find();
}

export async function findByName(name: string): Promise<Player | null> {
  return repo().findOneBy({ name });
}

export async function findByChatId(chatId: number): Promise<Player[]> {
  return dataSource
    .getRepository(Player)
    .createQueryBuilder("p")
    .innerJoin("player_to_chat", "ptc", "p.id = ptc.player_id")
    .where("ptc.chat_id = :chatId", { chatId })
    .select(["p.id", "p.name"])
    .getMany();
}

export async function upsertByName(name: string): Promise<void> {
  await dataSource.query(
    "INSERT INTO players (name) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = ?)",
    [name, name]
  );
}

export async function linkToChat(playerId: number, chatId: number): Promise<number> {
  const result = await dataSource.query(
    "INSERT IGNORE INTO player_to_chat (player_id, chat_id) VALUES (?, ?)",
    [playerId, chatId]
  );
  return result.affectedRows as number;
}

export async function unlinkFromChat(playerId: number, chatId: number): Promise<number> {
  const result = await dataSource.query(
    "DELETE FROM player_to_chat WHERE player_id = ? AND chat_id = ?",
    [playerId, chatId]
  );
  return result.affectedRows as number;
}
