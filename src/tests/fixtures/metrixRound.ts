import {
  HoleScore, MetrixRound, RoundPlayer, Scorecard, TrackedRoundPlayer,
} from "../../integrations/metrix/round/types";

// Typed builders for the normalized Metrix round, for tests across modules. Each fills in valid
// defaults, so a test spells out only what it is about.

/** A par 3 hole played in three, unless overridden. */
export function buildHoleScore(overrides: Partial<HoleScore> = {}): HoleScore {
  return { strokes: 3, relativeToPar: 0, obCount: 0, ...overrides };
}

/** An available card with these holes; `null` is a hole not recorded yet. */
export function buildScorecard(...holes: (HoleScore | null)[]): Scorecard {
  return { kind: "available", holes };
}

/** A registered player still playing, in first place of a two-player MA3 division. */
export function buildRoundPlayer(overrides: Partial<RoundPlayer> = {}): RoundPlayer {
  return {
    sourceId: 130, name: "Matti", division: "MA3", group: "1",
    scorecard: buildScorecard(null),
    round: { totalHoles: 1, status: "active" },
    standing: { position: 1, fieldSize: 2, isProvisional: false },
    totalStrokes: null, totalRelativeToPar: null,
    ...overrides,
  };
}

/** A round player matched to the chat's player `id`. */
export function buildTrackedPlayer(id: number, overrides: Partial<RoundPlayer> = {}): TrackedRoundPlayer {
  return { id, player: buildRoundPlayer(overrides) };
}

/** A one-hole round on 2026-10-02 with no players, unless overridden. */
export function buildRound(overrides: Partial<MetrixRound> = {}): MetrixRound {
  return {
    id: "123", name: "Viikkokisa", day: "2026-10-02", startsAt: null, courseName: "Testirata", courseId: null,
    layoutKey: "layout", holeLabels: ["1"], players: [],
    ...overrides,
  };
}
