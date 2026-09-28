import { describe, expect, it } from "vitest";
import { ValidationError } from "../../util/validation";
import { compareScorecards, parseScorecard } from "./commentaryFacts";

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

describe("compareScorecards", () => {
  it("reports every recorded hole in a catch-up batch, including a shotgun start", () => {
    const previous = parseScorecard([[], [], [], []]);
    const current = parseScorecard([[], [], { Result: "2", Diff: -1 }, { Result: "3", Diff: 0 }]);
    expect(compareScorecards(previous, current)).toEqual({
      kind: "compared",
      changes: [
        { kind: "recorded", holeNumber: 3, score: { strokes: 2, relativeToPar: -1, obCount: null } },
        { kind: "recorded", holeNumber: 4, score: { strokes: 3, relativeToPar: 0, obCount: null } },
      ],
    });
  });

  it("detects corrections even when the player's total is unchanged", () => {
    const previous = parseScorecard([{ Result: "3", Diff: 0 }, { Result: "4", Diff: 1 }]);
    const current = parseScorecard([{ Result: "4", Diff: 1 }, { Result: "3", Diff: 0 }]);
    expect(compareScorecards(previous, current)).toMatchObject({
      kind: "compared",
      changes: [
        { kind: "corrected", holeNumber: 1, previous: { strokes: 3 }, current: { strokes: 4 } },
        { kind: "corrected", holeNumber: 2, previous: { strokes: 4 }, current: { strokes: 3 } },
      ],
    });
  });

  it.each([
    { Result: "3", Diff: -1, PEN: 0 },
    { Result: "3", Diff: 0, PEN: 1 },
    { Result: "3" },
  ])("detects metadata changes when strokes do not change (%j)", score => {
    const previous = parseScorecard([{ Result: "3", Diff: 0, PEN: 0 }]);
    const current = parseScorecard([score]);
    expect(compareScorecards(previous, current)).toMatchObject({
      kind: "compared",
      changes: [{ kind: "corrected", holeNumber: 1 }],
    });
  });

  it("keeps removals, corrections and new scores distinct in a mixed batch", () => {
    const previous = parseScorecard([{ Result: "3" }, { Result: "4" }, []]);
    const current = parseScorecard([[], { Result: "3" }, { Result: "2" }]);
    expect(compareScorecards(previous, current)).toMatchObject({
      kind: "compared",
      changes: [
        { kind: "removed", holeNumber: 1, previous: { strokes: 3 } },
        { kind: "corrected", holeNumber: 2, previous: { strokes: 4 }, current: { strokes: 3 } },
        { kind: "recorded", holeNumber: 3, score: { strokes: 2 } },
      ],
    });
  });

  it("does not produce duplicate events for equivalent snapshots", () => {
    const previous = parseScorecard([{ Result: "3", Diff: "0", PEN: "0" }, []]);
    const current = parseScorecard([{ Result: 3, Diff: 0, PEN: 0 }, []]);
    expect(compareScorecards(previous, current)).toEqual({ kind: "compared", changes: [] });
  });

  it.each([
    [undefined, [{ Result: "3" }]],
    [[{ Result: "3" }], null],
    [[], [{ Result: "3" }]],
  ])("does not turn missing snapshots into score removals or new events", (previous, current) => {
    expect(compareScorecards(parseScorecard(previous), parseScorecard(current))).toEqual({
      kind: "unavailable", reason: "missing-scorecard",
    });
  });

  it.each([
    [[{ Result: "3" }, []], [{ Result: "3" }]],
    [[{ Result: "3" }], [{ Result: "3" }, { Result: "4" }]],
  ])("requires a stable hole count instead of guessing at a changed layout", (previous, current) => {
    expect(compareScorecards(parseScorecard(previous), parseScorecard(current))).toEqual({
      kind: "unavailable", reason: "hole-count-changed",
    });
  });
});
