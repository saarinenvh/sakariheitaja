import { dataSource } from "../../../db/dataSource";
import { MorningGreeting } from "./MorningGreeting.entity";

function greetings() {
  return dataSource.getRepository(MorningGreeting);
}

export async function save(chatId: number, text: string): Promise<void> {
  await greetings().insert({ chatId, text });
}

/** The chat's last `limit` greetings' texts, newest (last saved) first. */
export async function findRecentTexts(chatId: number, limit: number): Promise<string[]> {
  const rows = await greetings().find({ where: { chatId }, order: { id: "DESC" }, take: limit });
  return rows.map(row => row.text);
}
