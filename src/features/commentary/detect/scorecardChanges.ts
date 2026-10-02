import { HoleScore, Scorecard } from "../../../integrations/metrix/round/types";

/** What changed on one hole between two observations of a card. */
export type ScoreChange = (
  | { kind: "recorded"; holeNumber: number; score: HoleScore }
  | { kind: "corrected"; holeNumber: number; previous: HoleScore; current: HoleScore }
  | { kind: "removed"; holeNumber: number; previous: HoleScore }
) & { holeLabel?: string };

/** `unavailable` when either card is missing or the layout's hole count changed in between. */
export type ScorecardComparison =
  | { kind: "unavailable"; reason: "missing-scorecard" | "hole-count-changed" }
  | { kind: "compared"; changes: ScoreChange[] };

export function compareScorecards(previous: Scorecard, current: Scorecard): ScorecardComparison {
  if (previous.kind === "unavailable" || current.kind === "unavailable") {
    return { kind: "unavailable", reason: "missing-scorecard" };
  }
  if (previous.holes.length !== current.holes.length) {
    return { kind: "unavailable", reason: "hole-count-changed" };
  }

  const changes: ScoreChange[] = [];
  for (const [holeIndex, currentScore] of current.holes.entries()) {
    const change = compareHole(previous.holes[holeIndex], currentScore, holeIndex + 1);
    if (change) changes.push(change);
  }
  return { kind: "compared", changes };
}

function compareHole(previous: HoleScore | null, current: HoleScore | null, holeNumber: number): ScoreChange | null {
  if (previous === null && current !== null) {
    return { kind: "recorded", holeNumber, score: current };
  }
  if (previous !== null && current === null) {
    return { kind: "removed", holeNumber, previous };
  }
  if (previous !== null && current !== null && !scoresMatch(previous, current)) {
    return { kind: "corrected", holeNumber, previous, current };
  }
  return null;
}

function scoresMatch(previous: HoleScore, current: HoleScore): boolean {
  return previous.strokes === current.strokes
    && previous.relativeToPar === current.relativeToPar
    && previous.obCount === current.obCount;
}
