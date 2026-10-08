import { weekdayOf } from "../../shared/time";
import { GamePlan } from "./db/GamePlan.entity";

// How a plan reads in a message: shared by /hepit and the morning greeting.

const WEEKDAY_SHORT = ["su", "ma", "ti", "ke", "to", "pe", "la"];

/** What a plan's line shows; a saved plan is one, and so is a plan just read from a message. */
export type PlanLine = Pick<GamePlan, "day" | "startTime" | "courses"> & { players: readonly { name: string }[] };

/** "la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Wiltzu". */
export function formatPlanSummary(plan: PlanLine): string {
  const when = plan.startTime ? `${formatDay(plan.day)} klo ${formatTime(plan.startTime)}` : formatDay(plan.day);
  const where = plan.courses.join(" + ");
  const who = plan.players.map(player => player.name).join(", ");

  return who ? `${when} ${where} — ${who}` : `${when} ${where}`;
}

/** "la 10.10." from `2026-10-10`. */
function formatDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);

  return `${WEEKDAY_SHORT[weekdayOf(day)]} ${date}.${month}.`;
}

/** "9.00" from `09:00:00`. */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");

  return `${Number(hours)}.${minutes}`;
}
