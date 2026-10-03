import { HoleScore } from "../../integrations/metrix/round/types";

/** A hole score the records keep: an ace wins over the eagle or albatross it may also be. */
export type NotableScoreKind = "ace" | "eagle" | "albatross";

const EAGLE_RELATIVE_TO_PAR = -2;
const ALBATROSS_RELATIVE_TO_PAR = -3;

/** The kind of notable score a hole is, or null for any other score. */
export function notableScoreKind(score: HoleScore): NotableScoreKind | null {
  if (score.strokes === 1) return "ace";
  if (score.relativeToPar === ALBATROSS_RELATIVE_TO_PAR) return "albatross";
  if (score.relativeToPar === EAGLE_RELATIVE_TO_PAR) return "eagle";
  return null;
}
