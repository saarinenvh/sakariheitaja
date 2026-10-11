import { Api } from "grammy";
import { HTML_NO_PREVIEW } from "./sendOptions";
import { ChatMessenger } from "../features/chatMessenger";

export function createTelegramMessenger(api: Pick<Api, "sendMessage" | "sendAnimation">): ChatMessenger {
  return {
    sendText: async (chatId, text) => { await api.sendMessage(chatId, text); },
    sendHtml: async (chatId, html) => { await api.sendMessage(chatId, html, HTML_NO_PREVIEW); },
    sendAnimation: async (chatId, url) => { await api.sendAnimation(chatId, url); },
  };
}
