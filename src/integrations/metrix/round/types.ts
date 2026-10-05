// The normalized Metrix round: what the rest of the bot sees instead of Metrix's raw payload.
// How each field is derived from the payload is in ../README.md.

/** One recorded hole. */
export interface HoleScore {
  /** Throws including penalties; always a positive integer. */
  strokes: number;
  /** Throws relative to the hole's par, or null when Metrix sent no usable `Diff`. */
  relativeToPar: number | null;
  /** OB penalties from `PEN` or `OB`, or null when Metrix sent neither. */
  obCount: number | null;
}

/**
 * A player's card.
 * - `unavailable`: Metrix sent no card (`null` or `[]`) or one whose length doesn't match the layout.
 * - `available`: one entry per layout hole, in layout order; `null` is a hole not recorded yet (Metrix sends `[]`).
 */
export type Scorecard =
  | { kind: "unavailable" }
  | { kind: "available"; holes: readonly (HoleScore | null)[] };

/**
 * Where a player's round stands. Metrix has no completion flag:
 * - `active`: holes are still missing from the card.
 * - `complete`: every hole is recorded and the player isn't DNF.
 * - `dnf`: Metrix marked the player as did-not-finish.
 * - `unknown`: only for values built outside the Metrix parser (tests, partial data).
 */
export interface RoundState {
  totalHoles: number | null;
  status: "unknown" | "active" | "complete" | "dnf";
}

/** A player's place in their division. */
export interface Standing {
  /** 1-based place, shared by tied players; null for DNF, or when no place can be derived. */
  position: number | null;
  /** Players in the same division. */
  fieldSize: number | null;
  /** True when the place can't be trusted as this round's: no place yet, or it includes earlier rounds. */
  isProvisional: boolean;
}

export interface RoundPlayer {
  /** Metrix `UserID`, or null for an unregistered player (Metrix sends 0). */
  sourceId: number | null;
  name: string;
  division: string;
  group: string;
  scorecard: Scorecard;
  round: RoundState;
  standing: Standing;
  /** Metrix's own totals (`Sum`, `Diff`); null until Metrix reports them. */
  totalStrokes: number | null;
  totalRelativeToPar: number | null;
}

export interface MetrixRound {
  id: string;
  name: string;
  /** The round's day (`2026-10-03`); null when Metrix sent no real calendar date. */
  day: string | null;
  /**
   * When the round starts: Metrix's `Date` and `Time` as local time in `METRIX_TIME_ZONE`, the
   * day's 00:00 without a `Time`, and null without a `day`.
   */
  startsAt: Date | null;
  courseName: string;
  /** The layout's Metrix id, for the course API and statistics; null when Metrix sent none. */
  courseId: string | null;
  /** Changes when the layout (course name or holes) changes, so stored progress can be reset. */
  layoutKey: string;
  /** Hole labels in layout order: `NumberAlt` when set (e.g. "10A"), else the hole number. */
  holeLabels: readonly string[];
  players: readonly RoundPlayer[];
}

/** A round player matched to a player the chat follows (`players.id`). */
export interface TrackedRoundPlayer {
  id: number;
  player: RoundPlayer;
}
