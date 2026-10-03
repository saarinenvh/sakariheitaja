import { Competition } from "./db/Competition.entity";
import * as competitionRepo from "./db/competitionRepository";
import * as chatRepo from "../chats/db/chatRepository";

export async function start(chatId: number, chatName: string, metrixId: string): Promise<{ insertId: number }> {
  await chatRepo.addIfAbsent(chatId, chatName);
  return competitionRepo.create(chatId, metrixId);
}

export async function remove(id: string): Promise<void> {
  await competitionRepo.deleteById(Number(id));
}

export async function getUnfinished(): Promise<Competition[]> {
  return competitionRepo.findUnfinished();
}

export async function markDone(id: number): Promise<void> {
  return competitionRepo.markFinished(id);
}
