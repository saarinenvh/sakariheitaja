import { describe, expect, it } from "vitest";
import { checkReading } from "../compare";
import type { ExpectedPlan } from "../cases";
import type { PlanReading } from "../../../src/features/games/schema";

const EXPECTED: ExpectedPlan = {
  isPlan: true, day: "2026-10-10", time: "09:00", courses: ["Karjaa", "Härkälinna"], players: ["Pekka", "Matti"], creatorPlays: true,
};
const READING: PlanReading = { ...EXPECTED };

function failedFields(reading: Partial<PlanReading>): string[] {
  return checkReading(EXPECTED, { kind: "plan", reading: { ...READING, ...reading } }).fields
    .filter(field => !field.passed).map(field => field.field);
}

describe("checking a reading against its case", () => {
  it("passes a reading that matches", () => {
    expect(checkReading(EXPECTED, { kind: "plan", reading: READING }).passed).toBe(true);
  });

  it("ignores case, the players' order and stray spaces", () => {
    expect(failedFields({ courses: ["karjaa", " Härkälinna "], players: ["matti", "PEKKA"] })).toEqual([]);
  });

  it("fails the courses in the wrong order", () => {
    expect(failedFields({ courses: ["Härkälinna", "Karjaa"] })).toEqual(["courses"]);
  });

  it("fails each field that differs", () => {
    expect(failedFields({ day: "2026-10-11", time: null, players: ["Pekan", "Matti"], creatorPlays: false }))
      .toEqual(["day", "time", "players", "creatorPlays"]);
  });

  it("fails every field when the reader read no plan", () => {
    const check = checkReading(EXPECTED, { kind: "failed", reason: "the answer isn't a valid plan reading", reply: "{}" });

    expect(check.passed).toBe(false);
    expect(check.fields.every(field => !field.passed)).toBe(true);
    expect(check.fields[0].actual).toBe("failed: the answer isn't a valid plan reading");
  });

  it("checks only isPlan for a case that isn't a plan", () => {
    expect(checkReading({ isPlan: false }, { kind: "not-a-plan" })).toEqual({
      passed: true, fields: [{ field: "isPlan", passed: true, expected: "not a plan", actual: "not a plan" }],
    });
    expect(checkReading({ isPlan: false }, { kind: "plan", reading: READING }).passed).toBe(false);
  });
});
