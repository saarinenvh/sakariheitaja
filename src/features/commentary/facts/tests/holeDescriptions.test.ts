import { describe, expect, it } from "vitest";
import { HoleScore } from "../../../../integrations/metrix/round/types";
import { CourseCoordinates, CourseHoleDetails } from "../../../../integrations/metrix/course/courseDetails";
import { describeHoleHistory, describeHoleLength, describeTodayFieldAverage, describeWindOnHole, holeBearingDeg, HoleHistoryFacts } from "../holeDescriptions";
import { RoundPlayer } from "../../../../integrations/metrix/round/types";

const TEE: CourseCoordinates = { latitude: 60.2, longitude: 24.9 };
const COORDINATE_OFFSET_DEG = 0.001;

function layoutHole(overrides: Partial<CourseHoleDetails> = {}): CourseHoleDetails {
  return { label: "1", par: 3, lengthM: 80, tee: null, basket: null, ...overrides };
}

function northboundHole(): CourseHoleDetails {
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
