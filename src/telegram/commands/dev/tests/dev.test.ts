import { describe, expect, it } from "vitest";
import { formatErroredRounds } from "../dev";

describe("/virheet", () => {
  it("says when no round is in error", () => {
    expect(formatErroredRounds([])).toBe("Ei virheeseen jääneitä kierroksia.");
  });

  it("lists each round with its chat, Helsinki time and reason", () => {
    const message = formatErroredRounds([
      { id: 7, chatId: -100, metrixId: "3809486", erroredAt: new Date("2026-10-07T09:30:00Z"), errorReason: "Error: not a round" },
      { id: 8, chatId: -200, metrixId: "3809487", erroredAt: null, errorReason: null },
    ]);

    expect(message.split("\n").slice(2)).toEqual([
      "3809486 (kilpailu 7, chat -100) 7.10.2026 klo 12.30.00: Error: not a round",
      "3809487 (kilpailu 8, chat -200) ?: ?",
    ]);
  });
});
