import { describe, expect, it } from "vitest";
import { packLines, TELEGRAM_MESSAGE_LIMIT } from "../telegramText";

describe("packing lines into messages", () => {
  it("keeps lines that fit in one message", () => {
    expect(packLines(["a", "", "b"], 10)).toEqual(["a\n\nb"]);
  });

  it("starts a new message before a line that wouldn't fit, without splitting it", () => {
    expect(packLines(["aaaa", "bbbb", "cccc"], 9)).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("cuts a line too long for any message, ending it with an ellipsis", () => {
    expect(packLines(["x".repeat(12)], 10)).toEqual(["xxxxxxxxx…"]);
  });

  it("never leaves half an emoji when cutting", () => {
    // Each 🥏 is one character but two UTF-16 units.
    const [message] = packLines(["🥏".repeat(10)], 10);

    expect(message).toBe("🥏🥏🥏🥏…");
    expect(message.length).toBeLessThanOrEqual(10);
  });

  it("uses Telegram's limit by default", () => {
    expect(packLines(["y".repeat(5000)])[0]).toHaveLength(TELEGRAM_MESSAGE_LIMIT);
  });

  it("sends nothing for no lines", () => {
    expect(packLines([])).toEqual([]);
  });
});
