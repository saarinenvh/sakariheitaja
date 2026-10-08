import { daysBetween } from "../../shared/time";

/** The zone plans' days and times are in, and where "today" is. */
export const PLAN_TIME_ZONE = "Europe/Helsinki";

const MAX_DAYS_AHEAD = 60;

export type PlanDayCheck = { kind: "ok" } | { kind: "past" } | { kind: "too-far"; maxDaysAhead: number };

/** A plan is for today or a later day, at most `MAX_DAYS_AHEAD` days away. */
export function checkPlanDay(day: string, today: string): PlanDayCheck {
  const daysAhead = daysBetween(today, day);
  if (daysAhead < 0) return { kind: "past" };
  if (daysAhead > MAX_DAYS_AHEAD) return { kind: "too-far", maxDaysAhead: MAX_DAYS_AHEAD };

  return { kind: "ok" };
}
