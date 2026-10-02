import { completedRoundStrokes } from "../../../../integrations/metrix/round/results";
import { RoundPlayer } from "../../../../integrations/metrix/round/types";
import { CourseRatingAnchors } from "../../../../integrations/metrix/course/courseDetails";

const PRO_RATING_MIN = 1000;
const MA1_RATING_MIN = 935;
const MA2_RATING_MIN = 900;
const DIFFICULTY_CLASSES = [
  { minRating: PRO_RATING_MIN, label: "PRO-taso (erittäin vaativa)" },
  { minRating: MA1_RATING_MIN, label: "MA1-taso (vaativa)" },
  { minRating: MA2_RATING_MIN, label: "MA2-taso (keskitaso)" },
] as const;
const LOWEST_DIFFICULTY_CLASS = "MA3-taso (harrastetaso)";

// A 1000-rated round ("tonnin rundi") is the big milestone on the amateur scene.
const THOUSAND_RATING_MIN = 1000;
const NEAR_THOUSAND_RATING_MIN = 980;
const ROAST_RATING_BELOW = 750;

export type RoundRatingTier = "tonnin rundi" | "melkein tonnin rundi" | "surkea rundi";

export interface CommentaryRoundRating {
  rating: number;
  tier: RoundRatingTier;
}

/** Metrix course rating: linear interpolation through the two anchor (rating, strokes) points. */
export function computeRating(anchors: CourseRatingAnchors, totalStrokes: number): number | null {
  const { value1, result1, value2, result2 } = anchors;
  if (![value1, result1, value2, result2, totalStrokes].every(Number.isFinite)) return null;
  if (result1 === result2) return null;
  const rating = (value2 - value1) * (totalStrokes - result1) / (result2 - result1) + value1;
  return Number.isFinite(rating) ? Math.round(rating) : null;
}

export function describeCourseDifficulty(anchors: CourseRatingAnchors | null, coursePar: number | null): string | null {
  if (anchors === null || coursePar === null) return null;
  const parRating = computeRating(anchors, coursePar);
  if (parRating === null) return null;
  return `Radan par-rating noin ${parRating}: ${classifyDifficulty(parRating)}.`;
}

/** Ratings of every finished round, keyed by full player name; empty when the layout has no rating anchors. */
export function buildRoundRatings(anchors: CourseRatingAnchors | null, players: readonly RoundPlayer[]): Map<string, number> {
  const ratings = new Map<string, number>();
  if (anchors === null) return ratings;
  for (const player of players) {
    const strokes = completedRoundStrokes(player);
    const rating = strokes === null ? null : computeRating(anchors, strokes);
    if (rating !== null) ratings.set(player.name, rating);
  }
  return ratings;
}

/**
 * The model only ever sees exceptional ratings: the result rows show every rating, and an ordinary one
 * in the commentary text would just read as a number. Gating here keeps it out however the prompt is worded.
 */
export function selectCommentaryRating(rating: number | undefined): CommentaryRoundRating | null {
  if (rating === undefined) return null;
  if (rating >= THOUSAND_RATING_MIN) return { rating, tier: "tonnin rundi" };
  if (rating >= NEAR_THOUSAND_RATING_MIN) return { rating, tier: "melkein tonnin rundi" };
  if (rating < ROAST_RATING_BELOW) return { rating, tier: "surkea rundi" };
  return null;
}

function classifyDifficulty(rating: number): string {
  for (const difficultyClass of DIFFICULTY_CLASSES) {
    if (rating >= difficultyClass.minRating) return difficultyClass.label;
  }
  return LOWEST_DIFFICULTY_CLASS;
}
