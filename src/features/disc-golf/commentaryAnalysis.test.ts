import { describe, expect, it } from "vitest";
import { ValidationError } from "../../util/validation";
import {
  analyzeRound, CommentaryScope, comparePublishedStanding, parseRoundState, parseStanding,
} from "./commentaryAnalysis";
import { parseScorecard } from "./commentaryFacts";

const scope: CommentaryScope = {
  chatId: -100, competitionId: "competition", division: "MA3", playerId: 1,
};

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

describe("round analysis", () => {
  it("counts played holes in a shotgun start instead of using the highest hole number", () => {
    const scorecard = parseScorecard([[], [], [], { Result: 3, Diff: 0 }]);
    expect(analyzeRound(scorecard, parseRoundState({ totalHoles: 4 }))).toEqual({
      progress: { kind: "observed", completedHoles: 1, totalHoles: 4 },
      recordedStrokes: 3, recordedRelativeToPar: 0,
      scores: { underPar: 0, pars: 1, overPar: 0, unknown: 0 },
    });
  });

  it("does not invent a hole count or completion from a fully populated array", () => {
    const scorecard = parseScorecard([{ Result: 3, Diff: 0 }]);
    expect(analyzeRound(scorecard, parseRoundState({})).progress).toEqual({
      kind: "observed", completedHoles: 1, totalHoles: null,
    });
    expect(analyzeRound(scorecard, parseRoundState({ totalHoles: 1 })).progress.kind).toBe("observed");
  });

  it("confirms completion only when source status, hole count and recorded scores agree", () => {
    const state = parseRoundState({ totalHoles: 2, status: "complete" });
    expect(analyzeRound(parseScorecard([{ Result: 3 }, { Result: 4 }]), state).progress).toEqual({
      kind: "complete", completedHoles: 2, totalHoles: 2,
    });
    expect(analyzeRound(parseScorecard([{ Result: 3 }, []]), state).progress.kind).toBe("observed");
    expect(analyzeRound(parseScorecard([{ Result: 3 }]), state).progress).toEqual({
      kind: "observed", completedHoles: 1, totalHoles: null,
    });
  });

  it("keeps DNF distinct even with every hole populated", () => {
    expect(analyzeRound(parseScorecard([{ Result: 3 }]), parseRoundState({
      totalHoles: 1, status: "dnf",
    })).progress).toEqual({ kind: "dnf", completedHoles: 1, totalHoles: 1 });
  });

  it("keeps missing cards and unknown score metadata distinct from zero", () => {
    const state = parseRoundState({});
    expect(analyzeRound(parseScorecard(null), state)).toMatchObject({
      progress: { kind: "unknown" }, recordedStrokes: null, recordedRelativeToPar: null, scores: null,
    });
    expect(analyzeRound(parseScorecard([{ Result: 3 }, { Result: 2, Diff: -1 }]), state)).toMatchObject({
      recordedStrokes: 5, recordedRelativeToPar: null,
      scores: { underPar: 1, pars: 0, overPar: 0, unknown: 1 },
    });
    expect(analyzeRound(parseScorecard([[], []]), state)).toMatchObject({
      recordedStrokes: 0, recordedRelativeToPar: 0,
    });
  });

  it("does not expose an unsafe arithmetic total", () => {
    expect(analyzeRound(parseScorecard([
      { Result: Number.MAX_SAFE_INTEGER }, { Result: 2 },
    ]), parseRoundState({})).recordedStrokes).toBeNull();
  });
});

describe("standing movement since publication", () => {
  it.each([
    { previous: 11, current: 10, kind: "up" },
    { previous: 10, current: 11, kind: "down" },
  ])("compares numeric positions correctly ($kind)", ({ previous, current, kind }) => {
    expect(comparePublishedStanding(scope, parseStanding({ position: String(current), isProvisional: false }), {
      scope, standing: parseStanding({ position: String(previous), isProvisional: false }),
    })).toEqual({ kind, previousPosition: previous, currentPosition: current, places: 1 });
  });

  it("reports unchanged positions explicitly", () => {
    const standing = parseStanding({ position: 15, isProvisional: false });
    expect(comparePublishedStanding(scope, standing, { scope, standing })).toEqual({ kind: "unchanged", position: 15 });
  });

  it("does not invent movement without a published baseline", () => {
    expect(comparePublishedStanding(scope, parseStanding({ position: 1, isProvisional: false }), null))
      .toEqual({ kind: "unknown" });
  });

  it.each([
    { position: null, isProvisional: false },
    { position: 10, isProvisional: true },
  ])("requires known non-provisional positions on both sides (%j)", uncertain => {
    const known = parseStanding({ position: 11, isProvisional: false });
    const standing = parseStanding(uncertain);
    expect(comparePublishedStanding(scope, known, { scope, standing })).toEqual({ kind: "unknown" });
    expect(comparePublishedStanding(scope, standing, { scope, standing: known })).toEqual({ kind: "unknown" });
  });

  it.each([
    { chatId: -200 }, { competitionId: "other" }, { division: "MPO" }, { playerId: 2 },
  ])("rejects a published baseline from a different scope (%j)", mismatch => {
    expect(comparePublishedStanding(scope, parseStanding({ position: 1, isProvisional: false }), {
      scope: { ...scope, ...mismatch }, standing: parseStanding({ position: 10, isProvisional: false }),
    })).toEqual({ kind: "unknown" });
  });
});
