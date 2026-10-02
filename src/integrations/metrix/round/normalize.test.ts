import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../util/validation";
import { parseRoundState, parseScorecard, parseStanding } from "./normalize";

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
