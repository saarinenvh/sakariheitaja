import { Bot } from "grammy";
import { messageLengthGuard } from "./messageLimit";

export function createBot(token: string): Bot {
  const bot = new Bot(token);
  bot.api.config.use(messageLengthGuard);

  return bot;
}
