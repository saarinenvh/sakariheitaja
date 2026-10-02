import { describe, expect, it } from "vitest";
import { buildRoundRatings, computeRating, describeCourseDifficulty, selectCommentaryRating } from "./roundRatings";
import { CourseRatingAnchors } from "../../../integrations/metrix/course/courseDetails";
import { RoundPlayer, RoundState } from "../../../integrations/metrix/round/types";

const REAL_ANCHORS: CourseRatingAnchors = { value1: 909.61, result1: 63.06, value2: 1000, result2: 55.53 };
// Rating = 1000 - strokes, so a stroke count maps straight to a chosen rating.
const LINEAR_ANCHORS: CourseRatingAnchors = { value1: 1000, result1: 0, value2: 0, result2: 1000 };

function roundPlayer(name: string, status: RoundState["status"], totalStrokes: number): RoundPlayer {
  return {
    sourceId: null, name, division: "MA3", group: "1", scorecard: { kind: "unavailable" },
    round: { totalHoles: 18, status }, standing: { position: null, fieldSize: null, isProvisional: true },
    totalStrokes, totalRelativeToPar: null,
  };
}

describe("course rating", () => {
  it("interpolates the Metrix rating from the course anchors", () => {
    expect(computeRating(REAL_ANCHORS, 57)).toBe(982);
    expect(describeCourseDifficulty(REAL_ANCHORS, 57)).toBe("Radan par-rating noin 982: MA1-taso (vaativa).");
  });

  it.each([
    [0, "Radan par-rating noin 1000: PRO-taso (erittäin vaativa)."],
    [1, "Radan par-rating noin 999: MA1-taso (vaativa)."],
    [65, "Radan par-rating noin 935: MA1-taso (vaativa)."],
    [66, "Radan par-rating noin 934: MA2-taso (keskitaso)."],
    [100, "Radan par-rating noin 900: MA2-taso (keskitaso)."],
    [101, "Radan par-rating noin 899: MA3-taso (harrastetaso)."],
  ])("classifies par %d at the class boundaries", (coursePar, expected) => {
    expect(describeCourseDifficulty(LINEAR_ANCHORS, coursePar)).toBe(expected);
  });

  it("returns nothing when anchors or the stroke count are missing or degenerate", () => {
    expect(describeCourseDifficulty(null, 57)).toBeNull();
    expect(describeCourseDifficulty(REAL_ANCHORS, null)).toBeNull();
    expect(computeRating({ value1: 900, result1: 60, value2: 1000, result2: 60 }, 57)).toBeNull();
    expect(computeRating({ ...REAL_ANCHORS, value2: Number.NaN }, 57)).toBeNull();
  });
});

describe("round ratings", () => {
  const finished = (name: string, totalStrokes: number): RoundPlayer => roundPlayer(name, "complete", totalStrokes);

  it("rates finished rounds only", () => {
    const ratings = buildRoundRatings(LINEAR_ANCHORS, [
      finished("Ville", 12),
      roundPlayer("Kesken", "active", 3),
      roundPlayer("Luovutti", "dnf", 40),
    ]);
    expect(ratings).toEqual(new Map([["Ville", 988]]));
  });

  it("rates nothing when the layout has no rating anchors", () => {
    expect(buildRoundRatings(null, [finished("Ville", 12)]).size).toBe(0);
  });

  it.each([
    [1000, "tonnin rundi"],
    [999, "melkein tonnin rundi"],
    [980, "melkein tonnin rundi"],
    [749, "surkea rundi"],
  ] as const)("passes rating %d to the commentary as %s", (rating, tier) => {
    expect(selectCommentaryRating(rating)).toEqual({ rating, tier });
  });

  it.each([979, 750, undefined])("keeps rating %s out of the commentary", rating => {
    expect(selectCommentaryRating(rating)).toBeNull();
  });
});
