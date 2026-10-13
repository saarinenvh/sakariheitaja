import { describe, expect, it } from "vitest";
import { Bot, GrammyError, Transformer } from "grammy";
import { messageLengthGuard } from "../messageLimit";
import { TELEGRAM_MESSAGE_LIMIT } from "../../features/chatMessenger";

interface SentCall {
  method: string;
  payload: Record<string, unknown>;
}

const CHAT_ID = -100;
const KEYBOARD = { inline_keyboard: [[{ text: "Mukaan", callback_data: "join" }]] };

/**
 * A bot whose calls end in a fake Telegram instead of the network, with the guard on top: grammY
 * runs the transformer installed last first. `failOnCall` makes that call (1-based) fail.
 */
function guardedBot(failOnCall?: number) {
  const calls: SentCall[] = [];

  const fakeTelegram: Transformer = async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    if (calls.length === failOnCall) return { ok: false, error_code: 400, description: "Bad Request" };

    // A test fake: the result only needs the fields the tests read, not the method's full type.
    return { ok: true, result: { message_id: 500 + calls.length } as never };
  };

  const bot = new Bot("123:abc");
  bot.api.config.use(fakeTelegram);
  bot.api.config.use(messageLengthGuard);

  return { api: bot.api, calls };
}

function lines(count: number, length: number): string {
  return Array.from({ length: count }, (_, index) => String(index).padEnd(length, "x")).join("\n");
}

describe("the message length guard", () => {
  it("passes a message that fits through unchanged", async () => {
    const { api, calls } = guardedBot();

    await api.sendMessage(CHAT_ID, "<b>Moi</b>", { parse_mode: "HTML", reply_markup: KEYBOARD });

    expect(calls).toEqual([
      { method: "sendMessage", payload: { chat_id: CHAT_ID, text: "<b>Moi</b>", parse_mode: "HTML", reply_markup: KEYBOARD } },
    ]);
  });

  it("sends a long message as several, in order, each within the limit, and returns the first", async () => {
    const { api, calls } = guardedBot();
    const text = lines(100, 99);

    const sent = await api.sendMessage(CHAT_ID, text);

    const texts = calls.map(call => String(call.payload.text));
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.every(part => part.length <= TELEGRAM_MESSAGE_LIMIT)).toBe(true);
    expect(texts.join("\n")).toBe(text);
    expect(sent.message_id).toBe(501);
  });

  it("sends a single line too long for one message cut short, not as it is", async () => {
    const { api, calls } = guardedBot();

    await api.sendMessage(CHAT_ID, "x".repeat(5000));

    expect(calls).toHaveLength(1);
    expect(String(calls[0].payload.text)).toHaveLength(TELEGRAM_MESSAGE_LIMIT);
  });

  it("keeps the options on every part, and the buttons under the last one", async () => {
    const { api, calls } = guardedBot();

    await api.sendMessage(CHAT_ID, lines(100, 99), { parse_mode: "HTML", reply_markup: KEYBOARD });

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every(call => call.payload.parse_mode === "HTML")).toBe(true);
    expect(calls.map(call => call.payload.reply_markup)).toEqual([...calls.slice(1).map(() => undefined), KEYBOARD]);
  });

  it("splits HTML so each part's tags are whole", async () => {
    const { api, calls } = guardedBot();

    await api.sendMessage(CHAT_ID, `<code>${lines(100, 99)}</code>`, { parse_mode: "HTML" });

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every(call => /^<code>[^<]*<\/code>$/.test(String(call.payload.text)))).toBe(true);
  });

  it("stops at the first part Telegram refuses, and the sender sees the failure", async () => {
    const { api, calls } = guardedBot(2);

    await expect(api.sendMessage(CHAT_ID, lines(100, 99))).rejects.toBeInstanceOf(GrammyError);

    expect(calls).toHaveLength(2);
  });

  it("edits a long message to the part that fits one message", async () => {
    const { api, calls } = guardedBot();
    const text = lines(100, 99);

    await api.editMessageText(CHAT_ID, 7, text);

    const [edit] = calls;
    expect(calls).toHaveLength(1);
    expect(edit.method).toBe("editMessageText");
    expect(edit.payload.message_id).toBe(7);
    expect(text.startsWith(String(edit.payload.text))).toBe(true);
    expect(String(edit.payload.text).length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
  });

  it("leaves other calls alone", async () => {
    const { api, calls } = guardedBot();

    await api.pinChatMessage(CHAT_ID, 7);

    expect(calls).toEqual([{ method: "pinChatMessage", payload: { chat_id: CHAT_ID, message_id: 7 } }]);
  });
});
