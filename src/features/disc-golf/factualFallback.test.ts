import { describe, expect, it } from "vitest";
import { parseRoundState, parseStanding } from "./commentaryAnalysis";
import { parseScorecard } from "./commentaryFacts";
import { buildFactualCommentaryBrief, CommentarySnapshot } from "./factualCommentaryBrief";
import { buildFactualFallback } from "./factualFallback";

function buildBrief(previous: unknown, current: unknown, holeCount = 3) {
  const makeSnapshot = (scorecard: unknown): CommentarySnapshot => ({
    scope: { chatId: -100, competitionId: "round", division: "MA3", playerId: 4 },
    playerName: "Matti",
    courseName: "Nummenmäki",
    scorecard: parseScorecard(scorecard),
    round: parseRoundState({ totalHoles: holeCount }),
    standing: parseStanding({ position: 8, fieldSize: 20, isProvisional: false }),
  });
  const result = buildFactualCommentaryBrief({
    previousObserved: makeSnapshot(previous), current: makeSnapshot(current), lastPublished: null,
  });
  if (result.kind !== "ready") throw new Error(`Expected a brief, received ${result.kind}`);
  return result.brief;
}

describe("factual fallback", () => {
  it("states the hole result and its OB count", () => {
    const fallback = buildFactualFallback(buildBrief([[], [], []], [[], [], { Result: 5, Diff: 2, PEN: 1 }]));
    expect(fallback).toContain("tuplabogi");
    expect(fallback).toContain("1 OB");
  });

  it("describes score corrections and removals as edits instead of new achievements", () => {
    const brief = buildBrief(
      [{ Result: 5, Diff: 2 }, { Result: 3, Diff: 0 }, []],
      [{ Result: 4, Diff: 1 }, [], []],
    );
    const fallback = buildFactualFallback(brief);
    expect(fallback).toContain("tulos muuttui");
    expect(fallback).toContain("Matti:");
    expect(fallback).toContain("merkintä poistettiin");
    expect(fallback).not.toContain("uusi tulos");
  });

  it("varies the opening deterministically across different updates", () => {
    const first = buildFactualFallback(buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]));
    const second = buildFactualFallback(buildBrief([[], [], [], []], [[], [], [], { Result: 3, Diff: 0 }], 4));
    expect(first).not.toBe(second);
    expect(first).toContain("Matti:");
    expect(first).toContain("Väylä 3: par");
    expect(second).toContain("Väylä 4: par");
  });

  it("does not make unsupported standing or completion claims", () => {
    const fallback = buildFactualFallback(buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]));
    expect(fallback).toContain("Tämänhetkinen sijoitus");
    expect(fallback).not.toContain("nousua");
    expect(fallback).not.toContain("Kierros valmis");
  });
});
