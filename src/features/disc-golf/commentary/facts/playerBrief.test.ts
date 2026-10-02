import { describe, expect, it } from "vitest";
import { parseRoundState, parseStanding } from "../../../../integrations/metrix/round/normalize";
import { parseScorecard } from "../../../../integrations/metrix/round/normalize";
import { buildFactualCommentaryBrief, CommentarySnapshot, FactualCommentaryBrief } from "./playerBrief";
import { compareScorecards } from "../detect/scorecardChanges";
import { PublishedStanding } from "../detect/standingMovement";

function snapshot(scores: unknown, position = 10): CommentarySnapshot {
  return {
    scope: { chatId: -100, competitionId: "3802730", division: "MA3", playerId: 1 },
    playerName: "Alexander Wickholm",
    courseName: "Nummenmäki",
    scorecard: parseScorecard(scores),
    round: parseRoundState({ totalHoles: 3 }),
    standing: parseStanding({ position, fieldSize: 20, isProvisional: false }),
  };
}

interface BriefCase {
  previousObserved: CommentarySnapshot;
  current: CommentarySnapshot;
  lastPublished: PublishedStanding | null;
}

function briefFor({ previousObserved, current, lastPublished }: BriefCase): FactualCommentaryBrief {
  const comparison = compareScorecards(previousObserved.scorecard, current.scorecard);
  if (comparison.kind !== "compared") throw new Error(`Expected comparable cards, received ${comparison.reason}`);
  return buildFactualCommentaryBrief({ current, changes: comparison.changes, lastPublished });
}

describe("factual commentary brief", () => {
  it("uses the last published ranking rather than an intermediate observed ranking", () => {
    const previousObserved = snapshot([[], [], []], 15);
    const current = snapshot([[], [], { Result: 3, Diff: 0 }], 12);
    const brief = briefFor({ previousObserved, current, lastPublished: {
      scope: current.scope, standing: parseStanding({ position: 11, isProvisional: false }),
    } });
    expect(brief.movementSincePublication).toEqual({
      kind: "down", previousPosition: 11, currentPosition: 12, places: 1,
    });
    expect(brief.round.progress).toEqual({ kind: "observed", completedHoles: 1, totalHoles: 3 });
    expect(brief.changes).toMatchObject([{ kind: "recorded", holeNumber: 3 }]);
  });

  it("keeps catch-up events together without claiming chronological order", () => {
    const brief = briefFor({
      previousObserved: snapshot([[], [], []]),
      current: snapshot([{ Result: 3, Diff: 0 }, [], { Result: 2, Diff: -1 }]), lastPublished: null,
    });
    expect(brief.event).toBe("scores-recorded");
    expect(brief.changes).toHaveLength(2);
    expect(brief.limitations).toContain("play-order-unknown");
    expect(brief.movementSincePublication).toEqual({ kind: "unknown" });
  });

  it("recalculates totals after corrections/removals rather than retaining stale round prose", () => {
    const brief = briefFor({
      previousObserved: snapshot([{ Result: 6, Diff: 3 }, { Result: 4, Diff: 1 }, []]),
      current: snapshot([{ Result: 3, Diff: 0 }, [], []]), lastPublished: null,
    });
    expect(brief.event).toBe("scores-corrected");
    expect(brief.changes.map(change => change.kind)).toEqual(["corrected", "removed"]);
    expect(brief.round).toMatchObject({
      recordedStrokes: 3, recordedRelativeToPar: 0,
      scores: { underPar: 0, pars: 1, overPar: 0, unknown: 0 },
    });
  });

  it("distinguishes mixed updates and includes OB count as a known fact", () => {
    const brief = briefFor({
      previousObserved: snapshot([{ Result: 4, Diff: 1 }, [], []]),
      current: snapshot([{ Result: 3, Diff: 0 }, { Result: 5, Diff: 2, PEN: 1 }, []]), lastPublished: null,
    });
    expect(brief.event).toBe("mixed-update");
    expect(brief.limitations).toEqual(["play-order-unknown"]);
    expect(brief.changes).toContainEqual({
      kind: "recorded", holeNumber: 2, holeLabel: "2", score: { strokes: 5, relativeToPar: 2, obCount: 1 },
    });
  });

  it("keeps only the selected factual contract, not a full card or static profile", () => {
    const current = {
      ...snapshot([{ Result: 3, Diff: 0 }, [], []]),
      playerProfile: "Keskikastissa ja hyvässä vireessä",
      generatedHistory: "invented story",
    };
    const brief = briefFor({
      previousObserved: snapshot([[], [], []]), current, lastPublished: null,
    });
    expect(JSON.stringify(brief)).not.toMatch(/playerProfile|generatedHistory|scorecard|Keskikastissa|invented story/);
    expect(brief.standing.position).toBe(10);
  });

  it("replays the supplied hole-8-to-21 sequence with factual totals and numeric ranking movement", () => {
    const updates = [
      { diff: 0, total: 1, position: 13 },
      { diff: 1, total: 2, position: 12 },
      { diff: 1, total: 3, position: 13 },
      { diff: 0, total: 3, position: 11 },
      { diff: 0, total: 3, position: 10 },
      { diff: 0, total: 3, position: 10 },
      { diff: 3, total: 6, position: 15 },
      { diff: 0, total: 6, position: 15 },
      { diff: 1, total: 7, position: 15 },
      { diff: -1, total: 6, position: 14 },
      { diff: 2, total: 8, position: 15 },
      { diff: 0, total: 8, position: 14 },
      { diff: 0, total: 8, position: 14 },
      { diff: 0, total: 8, position: 14 },
    ];
    const scores: unknown[] = Array.from({ length: 21 }, () => []);
    scores[0] = { Result: 4, Diff: 1 };
    for (let holeIndex = 1; holeIndex < 7; holeIndex++) scores[holeIndex] = { Result: 3, Diff: 0 };
    let previousObserved = snapshot(scores, 13);
    previousObserved.round = parseRoundState({ totalHoles: 21 });

    for (const [updateIndex, update] of updates.entries()) {
      const holeIndex = updateIndex + 7;
      scores[holeIndex] = { Result: 3 + update.diff, Diff: update.diff };
      const current = snapshot(scores, update.position);
      current.round = parseRoundState({ totalHoles: 21 });
      const brief = briefFor({
        previousObserved, current,
        lastPublished: updateIndex === 0 ? null : {
          scope: previousObserved.scope, standing: previousObserved.standing,
        },
      });
      expect(brief.round.recordedRelativeToPar).toBe(update.total);
      expect(brief.round.progress).toMatchObject({ completedHoles: holeIndex + 1, totalHoles: 21 });
      if (holeIndex === 8 || holeIndex === 11) expect(brief.movementSincePublication.kind).toBe("up");
      if (holeIndex === 15) expect(brief.movementSincePublication.kind).toBe("unchanged");
      previousObserved = current;
    }
  });
});
