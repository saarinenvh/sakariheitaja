import { formatPlanSummary, GamePlan } from "../games";
import { gamesJoinLine } from "./messages";

/** The greeting's games part: today's games, the coming days' games, and the invitation. `today` is `YYYY-MM-DD`. */
export function formatGamesPart(plans: readonly GamePlan[], today: string): string {
  const todays = plans.filter(plan => plan.day === today);
  const upcoming = plans.filter(plan => plan.day !== today);

  const sections: string[] = [];
  if (todays.length > 0) sections.push(`Tänään pelataan:\n${formatLines(todays)}`);
  if (upcoming.length > 0) sections.push(`Tulossa:\n${formatLines(upcoming)}`);
  sections.push(gamesJoinLine);

  return sections.join("\n\n");
}

function formatLines(plans: readonly GamePlan[]): string {
  return plans.map(plan => `${plan.id}. ${formatPlanSummary(plan)}`).join("\n");
}
