import { describe, expect, it } from "vitest";
import { formatFallbackGreeting } from "../messages";

describe("formatFallbackGreeting", () => {
  it("escapes the opening line and the & for Telegram's HTML", () => {
    expect(formatFallbackGreeting("Kalja < jallu & muut \n", "9:00")).toBe(
      "Kalja &lt; jallu &amp; muut\nKello on <b>9:00</b> &amp; tämmöstä keliä ois sit tänää taas luvassa.",
    );
  });

  it("puts the time on its own line also after an opening line that doesn't end in a line break", () => {
    expect(formatFallbackGreeting("Joo, ei kyllä tänään pysty, takasin pullolle.", "9:00"))
      .toMatch(/^Joo, ei kyllä tänään pysty, takasin pullolle\.\nKello on <b>9:00<\/b>/u);
  });
});
