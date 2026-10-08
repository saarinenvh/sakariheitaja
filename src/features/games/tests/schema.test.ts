import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../shared/validation";
import { planReadingExample, planReadingSchema } from "../schema";

describe("the plan reader's answer", () => {
  it("accepts its example", () => {
    expect(() => parseOrThrow(planReadingSchema, planReadingExample, "plan reading example")).not.toThrow();
  });

  it("accepts an answer that isn't a plan, with no day or time", () => {
    const notAPlan = { isPlan: false, day: null, time: null, courses: [], players: [], creatorPlays: false };

    expect(planReadingSchema.safeParse(notAPlan).success).toBe(true);
  });

  it.each([
    ["an impossible day", { day: "2026-02-31" }],
    ["a day in another format", { day: "10.10.2026" }],
    ["a time with seconds", { time: "09:00:00" }],
    ["an hour that doesn't exist", { time: "24:00" }],
    ["an empty course", { courses: [" "] }],
    ["a missing field", { creatorPlays: undefined }],
  ])("refuses %s", (_, change) => {
    expect(planReadingSchema.safeParse({ ...planReadingExample, ...change }).success).toBe(false);
  });
});
