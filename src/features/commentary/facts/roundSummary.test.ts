import { describe, expect, it } from "vitest";
import { analyzeRound } from "./roundSummary";
import { parseRoundState, parseScorecard } from "../../../integrations/metrix/round/normalize";

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
