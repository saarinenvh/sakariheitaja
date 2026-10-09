import { Api, GrammyError } from "grammy";
import { findBotPin, saveBotPin } from "../features/chats";
import { moduleLogger } from "../shared/logger";

// The bot keeps at most one pin per chat. It's stored in the chat's row, so the bot only ever
// touches its own pin. A failed Telegram call (no admin rights, the message deleted) is logged and
// never fails the command that asked for it.

const log = moduleLogger("bot-pin");

export type PinApi = Pick<Api, "pinChatMessage" | "unpinChatMessage" | "editMessageText">;

/** Telegram's error for an edit to the text the message already has. */
const NOT_MODIFIED = "message is not modified";

/** Unpins the bot's previous pin, then pins the message, notifying the chat's members. */
export async function replaceBotPin(api: PinApi, chatId: number, messageId: number): Promise<void> {
  await removeBotPin(api, chatId);

  const pinned = await tryTelegram("pin", { chatId, messageId }, () => api.pinChatMessage(chatId, messageId));
  if (pinned) await saveBotPin(chatId, messageId);
}

/** Unpins the bot's pin, when it has one, and forgets it either way. */
export async function removeBotPin(api: PinApi, chatId: number): Promise<void> {
  const messageId = await findBotPin(chatId);
  if (messageId === null) return;

  await tryTelegram("unpin", { chatId, messageId }, () => api.unpinChatMessage(chatId, messageId));
  await saveBotPin(chatId, null);
}

/** Replaces the text of the bot's pin, when it has one. An edit notifies no one. */
export async function editBotPin(api: PinApi, chatId: number, text: string): Promise<void> {
  const messageId = await findBotPin(chatId);
  if (messageId === null) return;

  await tryTelegram("edit", { chatId, messageId }, () => api.editMessageText(chatId, messageId, text));
}

/** False when Telegram refused; an edit to the same text counts as done. */
async function tryTelegram(action: string, target: { chatId: number; messageId: number }, call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (error) {
    if (error instanceof GrammyError && error.description.includes(NOT_MODIFIED)) return true;

    log.warn({ err: error, ...target }, `could not ${action} the bot's pin`);
    return false;
  }
}
