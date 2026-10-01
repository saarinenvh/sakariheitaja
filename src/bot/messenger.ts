import { Api } from "grammy";
import { bot } from "./bot";
import { HTML_NO_PREVIEW } from "../config/bot";
import { ChatMessenger } from "../features/chatMessenger";

export function createTelegramMessenger(api: Pick<Api, "sendMessage">): ChatMessenger {
  return {
    sendText: async (chatId, text) => { await api.sendMessage(chatId, text); },
    sendHtml: async (chatId, html) => { await api.sendMessage(chatId, html, HTML_NO_PREVIEW); },
  };
}

export const telegramMessenger = createTelegramMessenger(bot.api);
