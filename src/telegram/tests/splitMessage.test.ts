import { describe, expect, it } from "vitest";
import { splitMessage } from "../splitMessage";
import { formatCourseResults } from "../commands/score-records/scoreRecords";
import { TELEGRAM_MESSAGE_LIMIT } from "../../features/chatMessenger";

describe("splitting plain text", () => {
  it("returns a message that fits as it is", () => {
    expect(splitMessage("a\n\nb", "plain", 10)).toEqual(["a\n\nb"]);
  });

  it("splits between lines, in order, into as few parts as fit", () => {
    expect(splitMessage("aaaa\nbbbb\ncccc", "plain", 9)).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("treats tags in plain text as text", () => {
    expect(splitMessage("<code>aaa\nbbb", "plain", 10)).toEqual(["<code>aaa", "bbb"]);
  });

  it("cuts a line too long for any part, ending it with an ellipsis, and goes on with the next", () => {
    expect(splitMessage(`${"x".repeat(12)}\nyy`, "plain", 10)).toEqual(["xxxxxxxxx…", "yy"]);
  });

  it("never leaves half an emoji when cutting", () => {
    // Each 🥏 is one character but two UTF-16 units.
    const [part] = splitMessage("🥏".repeat(10), "plain", 10);

    expect(part).toBe("🥏🥏🥏🥏…");
    expect(part.length).toBeLessThanOrEqual(10);
  });

  it("never starts a part with a blank line, which Telegram would refuse as empty", () => {
    expect(splitMessage(`${"x".repeat(10)}\n`, "plain", 10)).toEqual(["xxxxxxxxxx"]);
    expect(splitMessage(`${"x".repeat(10)}\n\n   \n${"y".repeat(10)}`, "plain", 10)).toEqual(["xxxxxxxxxx", "yyyyyyyyyy"]);
  });

  it("returns a message with nothing to show as it is, for Telegram to answer", () => {
    expect(splitMessage("\n".repeat(20), "plain", 10)).toEqual(["\n".repeat(20)]);
  });

  it("uses Telegram's limit by default", () => {
    expect(splitMessage("y".repeat(5000), "plain")[0]).toHaveLength(TELEGRAM_MESSAGE_LIMIT);
  });

  it("still works with the smallest limit", () => {
    expect(splitMessage("xyz", "plain", 1)).toEqual(["…"]);
  });

  it("refuses a limit that isn't a positive integer, instead of looping forever", () => {
    expect(() => splitMessage("x", "plain", 0)).toThrow(RangeError);
    expect(() => splitMessage("x", "plain", -5)).toThrow(RangeError);
    expect(() => splitMessage("x", "plain", 2.5)).toThrow(RangeError);
  });
});

describe("splitting HTML", () => {
  it("closes a tag open at a split and reopens it in the next part, so a table continues as one", () => {
    expect(splitMessage("<code>row1\nrow2\nrow3</code>", "html", 20)).toEqual([
      "<code>row1</code>", "<code>row2</code>", "<code>row3</code>",
    ]);
  });

  it("reopens nested tags in order, with their attributes", () => {
    const link = '<a href="https://x.test">';

    expect(splitMessage(`<b>${link}one\ntwo</a></b>`, "html", 40)).toEqual([
      `<b>${link}one</a></b>`, `<b>${link}two</a></b>`,
    ]);
  });

  it("cuts an over-long line between entities and tags, never inside one, and closes what it leaves open", () => {
    const line = `<b>${"a &amp; b ".repeat(10)}</b>`;

    expect(splitMessage(line, "html", 14)).toEqual(["<b>a …</b>"]);
    expect(splitMessage(line, "html", 15)).toEqual(["<b>a &amp;…</b>"]);
  });

  it("reopens the tags of a cut line's whole length for the next part", () => {
    expect(splitMessage(`<code>${"x".repeat(30)}\nrow</code>`, "html", 20)).toEqual([
      `<code>${"x".repeat(6)}…</code>`, "<code>row</code>",
    ]);
  });

  it("sends no part for a line of closing tags alone at a split", () => {
    expect(splitMessage(`<b>${"x".repeat(15)}\n</b>`, "html", 18)).toEqual([`<b>${"x".repeat(10)}…</b>`]);
  });

  it("keeps a part within the limit even when the tags to reopen don't fit", () => {
    const parts = splitMessage('<a href="https://example.com/long">ab\ncd</a>', "html", 30);

    expect(parts.every(part => part.length <= 30)).toBe(true);
  });

  it("splits a real long list into parts that each fit and keep their tags whole", () => {
    const courses = Array.from({ length: 400 }, (_, index) => ({ id: index + 1, name: `Kaatis ${index + 1}` }));
    const html = formatCourseResults({ kind: "ambiguous-course", courses });

    const parts = splitMessage(html, "html");

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(part => part.length <= TELEGRAM_MESSAGE_LIMIT)).toBe(true);
    expect(parts.every(part => countOf(part, "<b>") === countOf(part, "</b>"))).toBe(true);
    expect(parts.join("\n").match(/<b>\d+<\/b>/g)).toHaveLength(400);
  });
});

function countOf(text: string, piece: string): number {
  return text.split(piece).length - 1;
}
