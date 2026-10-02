import { Bot } from "grammy";
import dotenv from "dotenv";
dotenv.config();

export function createBot(token: string): Bot {
  return new Bot(token);
}
