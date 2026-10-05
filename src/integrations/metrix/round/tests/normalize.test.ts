import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../../shared/validation";
import { parseMetrixRound, parseRoundState, parseScorecard, parseStanding } from "../normalize";

describe("parseScorecard", () => {
  it("normalizes scores and empty hole slots without retaining extra source fields", () => {
    expect(parseScorecard([
      { Result: "3", Diff: "-1", PEN: "0", commentary: "invented story" },
      [],
      { Result: 5, Diff: "+2", PEN: 1 },
    ])).toEqual({
      kind: "available",
      holes: [
        { strokes: 3, relativeToPar: -1, obCount: 0 },
        null,
        { strokes: 5, relativeToPar: 2, obCount: 1 },
      ],
    });
  });

  it("preserves unknown score metadata instead of fabricating par or zero penalties", () => {
    expect(parseScorecard([
      { Result: "3" },
      { Result: "3", Diff: null, PEN: "" },
      { Result: "3", Diff: 0, PEN: 0 },
    ])).toEqual({
      kind: "available",
      holes: [
        { strokes: 3, relativeToPar: null, obCount: null },
        { strokes: 3, relativeToPar: null, obCount: null },
        { strokes: 3, relativeToPar: 0, obCount: 0 },
      ],
    });
  });

  it("normalizes Metrix OB and PEN fields to one OB count", () => {
    expect(parseScorecard([
      { Result: "3", OB: "1" },
      { Result: "4", PEN: 1 },
      { Result: "3", OB: 1, PEN: "1" },
    ])).toMatchObject({ kind: "available", holes: [{ obCount: 1 }, { obCount: 1 }, { obCount: 1 }] });
    expect(() => parseScorecard([{ Result: "3", OB: 1, PEN: 2 }])).toThrow(ValidationError);
  });

  it.each([undefined, null, []].map(input => ({ input })))("treats an absent scorecard as unavailable ($input)", ({ input }) => {
    expect(parseScorecard(input)).toEqual({ kind: "unavailable" });
  });

  it("distinguishes an available, unplayed scorecard from a missing one", () => {
    expect(parseScorecard([[], []])).toEqual({ kind: "available", holes: [null, null] });
  });

  it.each([
    [{ Result: "3 strokes" }],
    [{ Result: "" }],
    [{ Result: true }],
    [{ Result: "0" }],
    [{ Result: -1 }],
    [{ Result: 2.5 }],
    [{ Result: Number.MAX_SAFE_INTEGER + 1 }],
    [{ Result: "3", Diff: "bogey" }],
    [{ Result: "3", PEN: -1 }],
    [{ Result: "3", PEN: false }],
    [{ Result: "3", Diff: Infinity }],
    [null],
    [[3]],
    {},
  ].map(input => ({ input })))("rejects malformed data rather than treating it as an unplayed hole ($input)", ({ input }) => {
    expect(() => parseScorecard(input)).toThrow(ValidationError);
    expect(() => parseScorecard(input)).toThrow("Invalid Metrix PlayerResults");
  });

  it("does not mutate source score objects", () => {
    const rawScore = Object.freeze({ Result: "3", Diff: 0, PEN: 0 });
    expect(() => parseScorecard(Object.freeze([rawScore]))).not.toThrow();
    expect(rawScore).toEqual({ Result: "3", Diff: 0, PEN: 0 });
  });
});

describe("standing and round metadata validation", () => {
  it("normalizes numeric strings and defaults to unknown/provisional information", () => {
    expect(parseStanding({ position: "10", fieldSize: "20" })).toEqual({
      position: 10, fieldSize: 20, isProvisional: true,
    });
    expect(parseStanding({})).toEqual({ position: null, fieldSize: null, isProvisional: true });
    expect(parseRoundState({})).toEqual({ totalHoles: null, status: "unknown" });
  });

  it.each([
    { position: 0 }, { position: -1 }, { position: "tied 1" }, { fieldSize: 2.5 },
    { position: 3, fieldSize: 2 }, { isProvisional: "false" },
  ])("rejects invalid standing metadata (%j)", input => {
    expect(() => parseStanding(input)).toThrow(ValidationError);
  });

  it.each([{ totalHoles: 0 }, { totalHoles: true }, { status: "finished-ish" }])(
    "rejects invalid round metadata (%j)", input => {
      expect(() => parseRoundState(input)).toThrow(ValidationError);
    },
  );
});

describe("parseMetrixRound places", () => {
  const hole = (strokes: number) => ({ Result: String(strokes), Diff: strokes - 3 });
  const round = (cards: unknown[]) => ({
    Competition: {
      ID: "123", Name: "Kierros", Date: "2026-10-02", CourseName: "Testirata",
      Tracks: Array.from({ length: 4 }, (_, index) => ({ Number: String(index + 1), Par: "3" })),
      Results: cards.map((card, index) => ({ Name: `Pelaaja ${index}`, ClassName: "MA3", OrderNumber: 0, PlayerResults: card })),
    },
  });

  it("doesn't rank a player whose card doesn't match the layout", () => {
    const players = parseMetrixRound(round([[hole(2), hole(2)], [hole(3), hole(3), [], []]]), "123").players;
    expect(players[0].scorecard).toEqual({ kind: "unavailable" });
    expect(players.map(player => player.standing.position)).toEqual([null, 1]);
  });
});

describe("parseMetrixRound start", () => {
  const roundOn = (dateFields: Record<string, unknown>) => ({
    Competition: {
      ID: "123", Name: "Kierros", CourseName: "Testirata", ...dateFields,
      Tracks: [{ Number: "1", Par: "3" }],
      Results: [{ Name: "Pelaaja", ClassName: "MA3", OrderNumber: 0, PlayerResults: [[]] }],
    },
  });
  const start = (dateFields: Record<string, unknown>) => {
    const { day, startsAt } = parseMetrixRound(roundOn(dateFields), "123");
    return { day, startsAt: startsAt?.toISOString() ?? null };
  };

  it("reads Metrix's separate Date and Time as Finnish local time", () => {
    expect(start({ Date: "2026-05-01", Time: "06:00:00" })).toEqual({ day: "2026-05-01", startsAt: "2026-05-01T03:00:00.000Z" });
    expect(start({ Date: "2026-12-15", Time: "18:00:00" })).toEqual({ day: "2026-12-15", startsAt: "2026-12-15T16:00:00.000Z" });
  });

  it("starts at the day's midnight without a Time", () => {
    expect(start({ Date: "2026-05-01", Time: null })).toEqual({ day: "2026-05-01", startsAt: "2026-04-30T21:00:00.000Z" });
    expect(start({ Date: "2026-05-01" })).toEqual({ day: "2026-05-01", startsAt: "2026-04-30T21:00:00.000Z" });
    expect(start({ Date: "2026-05-01", Time: "6 am" })).toEqual({ day: "2026-05-01", startsAt: "2026-04-30T21:00:00.000Z" });
  });

  it.each([["an impossible date", "2026-02-30"], ["another format", "1.5.2026"], ["an empty one", ""], ["none", undefined]])(
    "keeps a round with %s, without a day or start", (_, date) => {
      expect(start({ Date: date, Time: "06:00:00" })).toEqual({ day: null, startsAt: null });
    },
  );
});
