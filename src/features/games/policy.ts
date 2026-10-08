import { daysBetween } from "../../shared/time";

/** The zone plans' days and times are in, and where "today" is. */
export const PLAN_TIME_ZONE = "Europe/Helsinki";

const MAX_DAYS_AHEAD = 60;

/**
 * The longest player name, `game_plan_players.name`'s VARCHAR(100). Checked before inserting:
 * `INSERT IGNORE` would otherwise cut a longer name short instead of refusing it.
 */
export const MAX_PLAYER_NAME_LENGTH = 100;

/** Characters as MariaDB counts them in a utf8mb4 column: code points, so an emoji is one. */
export function isPlayerNameTooLong(name: string): boolean {
  return [...name].length > MAX_PLAYER_NAME_LENGTH;
}

export type PlanDayCheck = { kind: "ok" } | { kind: "past" } | { kind: "too-far"; maxDaysAhead: number };

/** A plan is for today or a later day, at most `MAX_DAYS_AHEAD` days away. */
export function checkPlanDay(day: string, today: string): PlanDayCheck {
  const daysAhead = daysBetween(today, day);
  if (daysAhead < 0) return { kind: "past" };
  if (daysAhead > MAX_DAYS_AHEAD) return { kind: "too-far", maxDaysAhead: MAX_DAYS_AHEAD };

  return { kind: "ok" };
}
