import { Api } from "grammy";
import { bot } from "./bot";
import { HTML_NO_PREVIEW } from "./sendOptions";
import { ChatMessenger } from "../features/chatMessenger";

export function createTelegramMessenger(api: Pick<Api, "sendMessage" | "sendVideo">): ChatMessenger {
  return {
    sendText: async (chatId, text) => { await api.sendMessage(chatId, text); },
    sendHtml: async (chatId, html) => { await api.sendMessage(chatId, html, HTML_NO_PREVIEW); },
    sendVideo: async (chatId, url) => { await api.sendVideo(chatId, url); },
  };
}

export const telegramMessenger = createTelegramMessenger(bot.api);
