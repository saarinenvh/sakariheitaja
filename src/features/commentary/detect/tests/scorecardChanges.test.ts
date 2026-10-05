import { describe, expect, it } from "vitest";
import { compareScorecards, planSpecialScoreUpdate, ScoreChange } from "../scorecardChanges";
import { parseScorecard } from "../../../../integrations/metrix/round/normalize";

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

describe("planSpecialScoreUpdate", () => {
  const ace = { strokes: 1, relativeToPar: -2, obCount: 0 };
  const two = { strokes: 2, relativeToPar: -1, obCount: 0 };
  const card = parseScorecard([{ Result: "1", Diff: -2 }, [], { Result: "2", Diff: -1 }]);

  it("adds only the new holes when every change is a recorded hole", () => {
    const changes: ScoreChange[] = [{ kind: "recorded", holeNumber: 3, score: two }];
    expect(planSpecialScoreUpdate(changes, card)).toEqual({ kind: "add", holes: [{ holeNumber: 3, score: two }] });
  });

  it.each<[string, ScoreChange]>([
    ["a correction", { kind: "corrected", holeNumber: 1, previous: two, current: ace }],
    ["a removal", { kind: "removed", holeNumber: 2, previous: ace }],
  ])("rebuilds from the whole card after %s", (_, change) => {
    const recorded: ScoreChange = { kind: "recorded", holeNumber: 3, score: two };
    expect(planSpecialScoreUpdate([recorded, change], card)).toEqual({
      kind: "rebuild",
      holes: [
        { holeNumber: 1, score: { strokes: 1, relativeToPar: -2, obCount: null } },
        { holeNumber: 2, score: null },
        { holeNumber: 3, score: { strokes: 2, relativeToPar: -1, obCount: null } },
      ],
    });
  });
});
