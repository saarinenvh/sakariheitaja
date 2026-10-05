import { describe, expect, it } from "vitest";
import { formatSpecialScoreReport, parseSpecialScoreArguments } from "../specialScores";

const october = new Date("2026-10-05T12:00:00");

describe("parseSpecialScoreArguments", () => {
  it.each([
    ["", { period: { kind: "year", year: 2026 }, query: null }],
    ["alltime", { period: { kind: "alltime" }, query: null }],
    ["  ALLTIME   12 ", { period: { kind: "alltime" }, query: "12" }],
    ["Talin frisbeegolfrata", { period: { kind: "year", year: 2026 }, query: "Talin frisbeegolfrata" }],
    ["alltime Matti", { period: { kind: "alltime" }, query: "Matti" }],
  ])("reads %j", (match, expected) => {
    expect(parseSpecialScoreArguments(match, october)).toEqual(expected);
  });

  it("only takes alltime as the first word", () => {
    expect(parseSpecialScoreArguments("Matti alltime", october).query).toBe("Matti alltime");
  });
});

describe("formatSpecialScoreReport", () => {
  it("shows the count per player and the latest, with the hole when it is known", () => {
    const html = formatSpecialScoreReport("ace", {
      kind: "report", subject: { kind: "chat" }, period: { kind: "year", year: 2026 },
      leaderboard: [{ player: "Matti", count: 2 }, { player: "Jori <3", count: 1 }],
      latest: [
        { player: "Matti", course: "Kaatis", holeNumber: 7, date: "2026-09-12" },
        { player: "Jori <3", course: "Kaatis", holeNumber: null, date: "2026-06-01" },
      ],
    });
    expect(html).toContain("<b>🎯 Ässät</b> – vuonna 2026");
    expect(html).toContain("Matti            2");
    expect(html).toContain("• Matti – Kaatis, väylä 7 (12.9.2026)");
    expect(html).toContain("• Jori &lt;3 – Kaatis (1.6.2026)");
  });

  it("names the course or player and says when there are none", () => {
    const html = formatSpecialScoreReport("eagle", {
      kind: "report", subject: { kind: "player", name: "Matti" }, period: { kind: "alltime" }, leaderboard: [], latest: [],
    });
    expect(html).toBe("<b>🦅 Eaglet</b> – kaikkien aikojen (Matti)\n\nEi yhtään eaglea kaikkien aikojen. Säälittävää.");
  });

  it("asks to choose a course by id, with the command to use", () => {
    const html = formatSpecialScoreReport("albatross", { kind: "ambiguous-course", courses: [{ id: 3, name: "Kaatis & co" }] });
    expect(html).toContain("/albatrossit 12");
    expect(html).toContain("<b>3</b>: Kaatis &amp; co");
  });
});
