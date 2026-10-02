import { Bot } from "grammy";
import * as chatRepo from "../features/chats/chatRepository";
import { moduleLogger } from "../shared/logger";

const log = moduleLogger("chats");

/** Remembers every group the bot is added to or created in. */
export function registerChatTracking(bot: Pick<Bot, "on">): void {
  for (const event of ["message:new_chat_members", "message:group_chat_created"] as const) {
    bot.on(event, ctx => {
      chatRepo.addIfAbsent(ctx.chat.id, ctx.chat.title ?? "")
        .catch(error => log.error({ err: error, chatId: ctx.chat.id }, "could not register chat"));
    });
  }
}
