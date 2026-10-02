import { Player } from "./Player.entity";
import * as playerRepo from "./playerRepository";

export async function addToGroup(name: string, chatId: number): Promise<{ added: boolean }> {
  await playerRepo.upsertByName(name);
  const player = await playerRepo.findByName(name);
  if (!player) return { added: false };
  const affectedRows = await playerRepo.linkToChat(player.id, chatId);
  return { added: affectedRows > 0 };
}

export async function removeFromGroup(name: string, chatId: number): Promise<{ found: boolean; removed: boolean }> {
  const player = await playerRepo.findByName(name);
  if (!player) return { found: false, removed: false };
  const affectedRows = await playerRepo.unlinkFromChat(player.id, chatId);
  return { found: true, removed: affectedRows > 0 };
}

export async function getGroupPlayers(chatId: number): Promise<Player[]> {
  return playerRepo.findByChatId(chatId);
}
