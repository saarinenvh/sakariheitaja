import { HoleScore, Scorecard } from "../../../integrations/metrix/round/types";

/** What changed on one hole between two observations of a card. */
export type ScoreChange = (
  | { kind: "recorded"; holeNumber: number; score: HoleScore }
  | { kind: "corrected"; holeNumber: number; previous: HoleScore; current: HoleScore }
  | { kind: "removed"; holeNumber: number; previous: HoleScore }
) & { holeLabel?: string };

/** A hole as it now stands on the card; `score` is null when the hole has no score (any more). */
export interface HoleResult {
  holeNumber: number;
  score: HoleScore | null;
}

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

/**
 * How a player's update changes their saved special scores. Only special scores are saved; the
 * holes are the input they are picked from.
 * - `add`: the new holes; their special scores are added.
 * - `rebuild`: the whole card; the player's special scores in the round are rebuilt from it.
 */
export type SpecialScoreUpdate =
  | { kind: "add"; holes: readonly HoleResult[] }
  | { kind: "rebuild"; holes: readonly HoleResult[] };

/** Recorded holes are added; a correction or a removal rebuilds from the whole card. */
export function planSpecialScoreUpdate(changes: readonly ScoreChange[], scorecard: Scorecard): SpecialScoreUpdate {
  const recorded = changes.filter(isRecorded);
  if (recorded.length < changes.length) return { kind: "rebuild", holes: cardHoleResults(scorecard) };
  return { kind: "add", holes: recorded.map(change => ({ holeNumber: change.holeNumber, score: change.score })) };
}

function isRecorded(change: ScoreChange): change is Extract<ScoreChange, { kind: "recorded" }> {
  return change.kind === "recorded";
}

/** Every hole of the card as it now stands; none when the card is unavailable. */
export function cardHoleResults(scorecard: Scorecard): HoleResult[] {
  if (scorecard.kind === "unavailable") return [];
  return scorecard.holes.map((score, index) => ({ holeNumber: index + 1, score }));
}
