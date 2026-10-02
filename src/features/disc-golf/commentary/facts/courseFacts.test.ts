import { describe, expect, it } from "vitest";
import { HoleScore } from "../../../../integrations/metrix/round/scorecard";
import {
  buildRoundRatings,
  computeRating,
  CourseCoordinates,
  CourseRatingAnchors,
  describeCourseDifficulty,
  describeHoleHistory,
  describeHoleLength,
  describeTodayFieldAverage,
  describeWindOnHole,
  HoleHistoryFacts,
  HoleLayoutFacts,
  holeBearingDeg,
  selectCommentaryRating,
} from "./courseFacts";
import { RoundPlayer } from "../../../../integrations/metrix/round/normalize";

const REAL_ANCHORS: CourseRatingAnchors = { value1: 909.61, result1: 63.06, value2: 1000, result2: 55.53 };
// Rating = 1000 - strokes, so a stroke count maps straight to a chosen rating.
const LINEAR_ANCHORS: CourseRatingAnchors = { value1: 1000, result1: 0, value2: 0, result2: 1000 };

const TEE: CourseCoordinates = { latitude: 60.2, longitude: 24.9 };
const COORDINATE_OFFSET_DEG = 0.001;

function layoutHole(overrides: Partial<HoleLayoutFacts> = {}): HoleLayoutFacts {
  return { label: "1", par: 3, lengthM: 80, tee: null, basket: null, ...overrides };
}

function northboundHole(): HoleLayoutFacts {
  return layoutHole({ tee: TEE, basket: { latitude: TEE.latitude + COORDINATE_OFFSET_DEG, longitude: TEE.longitude } });
}

function historyHole(overrides: Partial<HoleHistoryFacts> = {}): HoleHistoryFacts {
  return { label: "1", par: 3, averageStrokes: 4.1, difficultyRank: null, aces: null, ...overrides };
}

const TOTAL_HOLES = 18;

function player(strokesOnFirstHole: number | null, overrides: Partial<RoundPlayer> = {}): RoundPlayer {
  const holes: (HoleScore | null)[] = Array.from({ length: TOTAL_HOLES }, () => null);
  if (strokesOnFirstHole !== null) holes[0] = { strokes: strokesOnFirstHole, relativeToPar: strokesOnFirstHole - 3, obCount: 0 };
  return {
    sourceId: null, name: "Pelaaja", division: "MA3", group: "1",
    scorecard: { kind: "available", holes },
    round: { totalHoles: TOTAL_HOLES, status: "active" },
    standing: { position: null, fieldSize: null, isProvisional: true },
    totalStrokes: null, totalRelativeToPar: null,
    ...overrides,
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
  const finished = (name: string, totalStrokes: number): RoundPlayer =>
    player(3, { name, totalStrokes, round: { totalHoles: TOTAL_HOLES, status: "complete" } });

  it("rates finished rounds only", () => {
    const ratings = buildRoundRatings(LINEAR_ANCHORS, [
      finished("Ville", 12),
      player(3, { name: "Kesken", totalStrokes: 3 }),
      player(3, { name: "Luovutti", totalStrokes: 40, round: { totalHoles: TOTAL_HOLES, status: "dnf" } }),
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

describe("hole length", () => {
  const layout = [layoutHole({ lengthM: 57 }), layoutHole({ lengthM: 80 }), layoutHole({ lengthM: 120 })];

  it("states par and length", () => {
    expect(describeHoleLength(layoutHole({ lengthM: 80 }), layout)).toBe("Par 3, 80 m.");
  });

  it("omits the par when it is unknown", () => {
    expect(describeHoleLength(layoutHole({ par: null, lengthM: 80 }), layout)).toBe("80 m.");
  });

  it("marks the unique shortest and longest holes", () => {
    expect(describeHoleLength(layout[0], layout)).toBe("Par 3, 57 m, radan lyhyin.");
    expect(describeHoleLength(layout[2], layout)).toBe("Par 3, 120 m, radan pisin.");
  });

  it("does not mark extremes with fewer than three known lengths", () => {
    const sparse = [layoutHole({ lengthM: 57 }), layoutHole({ lengthM: 120 }), layoutHole({ lengthM: null })];
    expect(describeHoleLength(sparse[0], sparse)).toBe("Par 3, 57 m.");
  });

  it("does not mark a shared shortest length", () => {
    const tied = [layoutHole({ lengthM: 57 }), layoutHole({ lengthM: 57 }), layoutHole({ lengthM: 120 })];
    expect(describeHoleLength(tied[0], tied)).toBe("Par 3, 57 m.");
  });

  it("returns nothing without a length", () => {
    expect(describeHoleLength(layoutHole({ lengthM: null }), layout)).toBeNull();
  });
});

describe("wind on the hole", () => {
  it("computes bearings for due north and due east", () => {
    const north = { latitude: TEE.latitude + COORDINATE_OFFSET_DEG, longitude: TEE.longitude };
    const east = { latitude: TEE.latitude, longitude: TEE.longitude + COORDINATE_OFFSET_DEG };
    expect(holeBearingDeg(TEE, north)).toBeCloseTo(0, 3);
    expect(holeBearingDeg(TEE, east)).toBeCloseTo(90, 1);
  });

  it.each([
    [0, "Vastatuuli 6,5 m/s."],
    [350, "Vastatuuli 6,5 m/s."],
    [180, "Myötätuuli 6,5 m/s."],
    [90, "Sivutuuli oikealta 6,5 m/s."],
    [270, "Sivutuuli vasemmalta 6,5 m/s."],
  ])("classifies wind from %d° on a northbound hole", (windFromDeg, expected) => {
    expect(describeWindOnHole(northboundHole(), windFromDeg, 6.5)).toBe(expected);
  });

  it("formats whole wind speeds without a decimal", () => {
    expect(describeWindOnHole(northboundHole(), 0, 4)).toBe("Vastatuuli 4 m/s.");
  });

  it("returns nothing for weak wind, missing wind or missing coordinates", () => {
    expect(describeWindOnHole(northboundHole(), 0, 2.9)).toBeNull();
    expect(describeWindOnHole(northboundHole(), null, 6)).toBeNull();
    expect(describeWindOnHole(northboundHole(), 0, null)).toBeNull();
    expect(describeWindOnHole(layoutHole({ tee: TEE, basket: null }), 0, 6)).toBeNull();
  });
});

describe("hole history", () => {
  it("describes the hardest hole with its historical average", () => {
    expect(describeHoleHistory(historyHole({ difficultyRank: 18 }), 18))
      .toBe("Radan vaikein väylä, historiallinen keskiarvo 4,1 heittoa (par 3).");
  });

  it("describes the easiest hole", () => {
    expect(describeHoleHistory(historyHole({ difficultyRank: 1, averageStrokes: null }), 18)).toBe("Radan helpoin väylä.");
  });

  it("converts a middle rank into hardness order", () => {
    expect(describeHoleHistory(historyHole({ difficultyRank: 15, averageStrokes: null }), 18)).toBe("Radan 4. vaikein väylä.");
  });

  it("appends aces in singular and plural", () => {
    expect(describeHoleHistory(historyHole({ aces: 1 }), 18)).toBe("Historiallinen keskiarvo 4,1 heittoa (par 3); väylällä tehty 1 ässä.");
    expect(describeHoleHistory(historyHole({ aces: 7, par: null }), 18)).toBe("Historiallinen keskiarvo 4,1 heittoa; väylällä tehty 7 ässää.");
  });

  it("returns nothing without an average or a rank, even with aces", () => {
    expect(describeHoleHistory(historyHole({ averageStrokes: null, aces: 3 }), 18)).toBeNull();
  });

  it("ignores a rank outside the hole count", () => {
    expect(describeHoleHistory(historyHole({ difficultyRank: 19, averageStrokes: null }), 18)).toBeNull();
  });
});

describe("today's field average", () => {
  it("averages recorded strokes of active players", () => {
    expect(describeTodayFieldAverage([player(3), player(4), player(4)], 0))
      .toBe("Tänään kentän keskiarvo väylällä 3,7 heittoa (3 pelaajaa).");
  });

  it("excludes DNF players, unavailable scorecards and unrecorded holes from the threshold", () => {
    const players = [
      player(3), player(4),
      player(9, { round: { totalHoles: TOTAL_HOLES, status: "dnf" } }),
      player(null),
      player(null, { scorecard: { kind: "unavailable" } }),
    ];
    expect(describeTodayFieldAverage(players, 0)).toBeNull();
  });

  it("returns nothing for a hole index beyond the scorecard", () => {
    expect(describeTodayFieldAverage([player(3), player(4), player(4)], TOTAL_HOLES)).toBeNull();
  });
});
