import { HoleScore } from "../../integrations/metrix/round/types";
import { HoleResult } from "../commentary";

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

/** The holes that are special scores, with their kind. */
export function specialScores(holes: readonly HoleResult[]): { holeNumber: number; kind: NotableScoreKind }[] {
  return holes.flatMap(({ holeNumber, score }) => {
    const kind = score ? notableScoreKind(score) : null;
    return kind ? [{ holeNumber, kind }] : [];
  });
}

const LATEST_SPECIAL_SCORE_COUNT = 5;

/** How many special scores a player has. */
export interface SpecialScoreCount {
  player: string;
  count: number;
}

/** Count per player, most first (ties by name), and the latest few, from rows newest first. */
export function summarizeSpecialScores<Row extends { player: string }>(
  rowsNewestFirst: readonly Row[],
): { leaderboard: SpecialScoreCount[]; latest: Row[] } {
  const counts = new Map<string, number>();
  for (const row of rowsNewestFirst) counts.set(row.player, (counts.get(row.player) ?? 0) + 1);

  const leaderboard = [...counts].map(([player, count]) => ({ player, count }))
    .sort((a, b) => b.count - a.count || a.player.localeCompare(b.player, "fi"));

  return { leaderboard, latest: rowsNewestFirst.slice(0, LATEST_SPECIAL_SCORE_COUNT) };
}

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/**
 * The date a special score is saved with: the round's, from Metrix's `Date` (`2026-10-03`). An
 * unexpected format falls back to today's local date rather than failing the save.
 */
export function specialScoreDate(roundDate: string, now: Date): string {
  const roundDay = ISO_DATE_PREFIX.exec(roundDate.trim())?.[1];
  if (roundDay) return roundDay;

  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
