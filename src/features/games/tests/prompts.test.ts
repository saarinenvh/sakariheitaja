import { describe, expect, it } from "vitest";
import { buildPlanReaderMessages } from "../prompts";

function calendar(today: string): string[] {
  return buildPlanReaderMessages("la Tali", "Ville", today, "Säännöt.")[1].content.split("\n").filter(line => line.startsWith("- "));
}

describe("the reader's calendar", () => {
  it("lists today and the next 13 days, with today, tomorrow and the day after named", () => {
    const days = calendar("2026-10-08");

    expect(days).toHaveLength(14);
    expect(days.slice(0, 3)).toEqual([
      "- torstai (to) 8.10.2026 = 2026-10-08, tällä viikolla, tänään",
      "- perjantai (pe) 9.10.2026 = 2026-10-09, tällä viikolla, huomenna",
      "- lauantai (la) 10.10.2026 = 2026-10-10, tällä viikolla, ylihuomenna",
    ]);
  });

  it("starts next week on Monday", () => {
    const days = calendar("2026-10-08");

    expect(days[3]).toBe("- sunnuntai (su) 11.10.2026 = 2026-10-11, tällä viikolla");
    expect(days[4]).toBe("- maanantai (ma) 12.10.2026 = 2026-10-12, ensi viikolla");
  });

  it("asked on a Sunday, spans three weeks", () => {
    const days = calendar("2026-10-11");

    expect(days[0]).toBe("- sunnuntai (su) 11.10.2026 = 2026-10-11, tällä viikolla, tänään");
    expect(days[6]).toBe("- lauantai (la) 17.10.2026 = 2026-10-17, ensi viikolla");
    expect(days[8]).toBe("- maanantai (ma) 19.10.2026 = 2026-10-19, sitä seuraavalla viikolla");
  });
});
