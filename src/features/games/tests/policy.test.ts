import { describe, expect, it } from "vitest";
import { checkPlanDay, isPlayerNameTooLong } from "../policy";

const TODAY = "2026-10-08";

describe("a plan's day", () => {
  it("is fine from today to 60 days ahead", () => {
    expect(checkPlanDay(TODAY, TODAY)).toEqual({ kind: "ok" });
    expect(checkPlanDay("2026-12-07", TODAY)).toEqual({ kind: "ok" });
  });

  it("can't be in the past", () => {
    expect(checkPlanDay("2026-10-07", TODAY)).toEqual({ kind: "past" });
  });

  it("can't be more than 60 days ahead", () => {
    expect(checkPlanDay("2026-12-08", TODAY)).toEqual({ kind: "too-far", maxDaysAhead: 60 });
  });
});

describe("a player's name", () => {
  it("fits up to 100 characters", () => {
    expect(isPlayerNameTooLong("a".repeat(100))).toBe(false);
    expect(isPlayerNameTooLong("a".repeat(101))).toBe(true);
  });

  it("counts an emoji as one character, as MariaDB does", () => {
    expect(isPlayerNameTooLong("⛳".repeat(100))).toBe(false);
  });
});
