import { Player } from "./db/Player.entity";
import * as playerRepo from "./db/playerRepository";

export async function addToGroup(name: string, chatId: number): Promise<{ added: boolean }> {
  await playerRepo.addIfAbsent(name);
  const player = await playerRepo.findByName(name);
  if (!player) return { added: false };

  return { added: await playerRepo.linkToChat(player.id, chatId) };
}

export async function removeFromGroup(name: string, chatId: number): Promise<{ found: boolean; removed: boolean }> {
  const player = await playerRepo.findByName(name);
  if (!player) return { found: false, removed: false };

  return { found: true, removed: await playerRepo.unlinkFromChat(player.id, chatId) };
}

export async function getGroupPlayers(chatId: number): Promise<Player[]> {
  return playerRepo.findByChatId(chatId);
}
