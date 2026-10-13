import type { ApiCallFn, RawApi, Transformer } from "grammy";
import type { ApiResponse, Message } from "grammy/types";
import { moduleLogger } from "../shared/logger";
import { splitMessage, TextFormat } from "./splitMessage";

type SendMessagePayload = Parameters<RawApi["sendMessage"]>[0];
type EditMessageTextPayload = Parameters<RawApi["editMessageText"]>[0];
type EditResult = Awaited<ReturnType<RawApi["editMessageText"]>>;
/** grammY's own AbortSignal type, not the DOM one. */
type Signal = Parameters<ApiCallFn>[2];

const log = moduleLogger("message-limit");

/**
 * Keeps every message within Telegram's length limit, so no sender has to. A long message goes out
 * as several, in order, and the sender gets the first back; a long edit keeps what fits one message.
 */
export const messageLengthGuard: Transformer = (prev, method, payload, signal) => {
  // Checking `method` doesn't narrow `payload` or the result in grammY's generic signature, hence the casts.
  if (method === "sendMessage") {
    return sendInParts(prev, payload as SendMessagePayload, signal) as ReturnType<typeof prev<typeof method>>;
  }

  if (method === "editMessageText") {
    return editWithFirstPart(prev, payload as EditMessageTextPayload, signal) as ReturnType<typeof prev<typeof method>>;
  }

  return prev(method, payload, signal);
};

/**
 * Sends the parts in order and stops at the first failure. The reply quote and any effect go with
 * the first part, any buttons under the last.
 */
async function sendInParts(prev: ApiCallFn, payload: SendMessagePayload, signal: Signal): Promise<ApiResponse<Message.TextMessage>> {
  const format = splittableFormat(payload);
  if (format === null) return prev("sendMessage", payload, signal);

  const parts = splitMessage(payload.text, format);
  if (parts.length === 1 && parts[0] === payload.text) return prev("sendMessage", payload, signal);

  log.info({ chatId: payload.chat_id, parts: parts.length }, "long message sent in parts");

  const { reply_markup: replyMarkup, reply_parameters: replyParameters, message_effect_id: messageEffectId, ...rest } = payload;
  const responses: ApiResponse<Message.TextMessage>[] = [];

  for (const [index, text] of parts.entries()) {
    const firstOnly = index === 0 ? { reply_parameters: replyParameters, message_effect_id: messageEffectId } : {};
    const lastOnly = index === parts.length - 1 ? { reply_markup: replyMarkup } : {};

    const response = await prev("sendMessage", { ...rest, ...firstOnly, ...lastOnly, text }, signal);
    if (!response.ok) return response;

    responses.push(response);
  }

  return responses[0];
}

/** An edit can't become several messages, so it keeps the first part. */
async function editWithFirstPart(prev: ApiCallFn, payload: EditMessageTextPayload, signal: Signal): Promise<ApiResponse<EditResult>> {
  const format = splittableFormat(payload);
  if (format === null) return prev("editMessageText", payload, signal);

  const [firstPart] = splitMessage(payload.text, format);
  if (firstPart !== payload.text) log.warn({ chatId: payload.chat_id, messageId: payload.message_id }, "long edit cut to one message");

  return prev("editMessageText", { ...payload, text: firstPart }, signal);
}

/**
 * How the text can be split, or null when a split would break its formatting: Markdown spans can
 * cross lines, and entity offsets point into the whole text. Those go to Telegram as they are.
 */
function splittableFormat(payload: SendMessagePayload | EditMessageTextPayload): TextFormat | null {
  if (payload.entities !== undefined) return null;
  if (payload.parse_mode === undefined) return "plain";

  return payload.parse_mode === "HTML" ? "html" : null;
}
