import { describe, expect, it } from "vitest";
import { formatPlanSummary } from "../planSummary";
import { GamePlan } from "../db/GamePlan.entity";

/** A plan with only the fields the summary reads. */
function plan(fields: Partial<GamePlan> & { playerNames?: string[] }): GamePlan {
  const { playerNames = [], ...rest } = fields;

  return {
    id: 12, day: "2026-10-10", startTime: "09:00:00", courses: ["Karjaa", "Härkälinna"],
    players: playerNames.map(name => ({ name })), ...rest,
  } as GamePlan;
}

describe("the plan summary", () => {
  it("shows the day, time, courses and players", () => {
    expect(formatPlanSummary(plan({ playerNames: ["Ville", "Wiltzu"] })))
      .toBe("la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Wiltzu");
  });

  it("leaves out a time and players it doesn't have", () => {
    expect(formatPlanSummary(plan({ startTime: null, courses: ["Tali"] }))).toBe("la 10.10. Tali");
  });
});
