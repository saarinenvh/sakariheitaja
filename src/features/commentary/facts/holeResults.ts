import { HoleScore } from "../../../integrations/metrix/round/types";

// Finnish names for hole results, shared by the result rows, the scorecard table and the model input.
const HOLE_SCORE_NAMES = new Map([[0, "par"], [-1, "birdie"], [-2, "eagle"], [1, "bogi"], [2, "tuplabogi"]]);

/** Result name with OB count, as shown in result rows and the scorecard table. */
export function formatHoleScore(score: HoleScore): string {
  const label = holeScoreName(score);
  return score.obCount !== null && score.obCount > 0 ? `${label} (${score.obCount} OB)` : label;
}

export function holeScoreName(score: HoleScore): string {
  if (score.strokes === 1) return "ässä";
  if (score.relativeToPar === null) return `${score.strokes} heittoa`;
  return HOLE_SCORE_NAMES.get(score.relativeToPar) ?? formatSigned(score.relativeToPar);
}

/** A score relative to par with its sign: "+2", "-1", "0". */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
