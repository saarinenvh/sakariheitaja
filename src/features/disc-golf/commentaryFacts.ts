import { z } from "zod";
import { parseOrThrow } from "../../util/validation";

const integerSchema = z.union([
  z.number().int(),
  z.string().trim().regex(/^[+-]?\d+$/).transform(Number).pipe(z.number().int()),
]);

const optionalIntegerSchema = z.union([
  integerSchema,
  z.literal("").transform(() => null),
]).nullish().transform(value => value ?? null);

const holeScoreSchema = z.object({
  Result: integerSchema.pipe(z.number().int().positive()),
  Diff: optionalIntegerSchema,
  PEN: optionalIntegerSchema.refine(value => value === null || value >= 0),
}).transform(score => ({
  strokes: score.Result,
  relativeToPar: score.Diff,
  penaltyStrokes: score.PEN,
}));

const scorecardSchema = z.array(z.union([
  holeScoreSchema,
  z.tuple([]).transform(() => null),
])).nullish();

export type HoleScore = Readonly<z.output<typeof holeScoreSchema>>;

export type Scorecard =
  | { kind: "unavailable" }
  | { kind: "available"; holes: readonly (HoleScore | null)[] };

export type ScoreChange =
  | { kind: "recorded"; holeNumber: number; score: HoleScore }
  | { kind: "corrected"; holeNumber: number; previous: HoleScore; current: HoleScore }
  | { kind: "removed"; holeNumber: number; previous: HoleScore };

export type ScorecardComparison =
  | { kind: "unavailable"; reason: "missing-scorecard" | "hole-count-changed" }
  | { kind: "compared"; changes: ScoreChange[] };

export function parseScorecard(input: unknown): Scorecard {
  const holes = parseOrThrow(scorecardSchema, input, "Metrix PlayerResults");
  if (!holes || holes.length === 0) return { kind: "unavailable" };
  return { kind: "available", holes };
}

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
    && previous.penaltyStrokes === current.penaltyStrokes;
}
