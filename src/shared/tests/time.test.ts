import { describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "../time";

const HELSINKI = "Europe/Helsinki";

describe("zonedTimeToInstant", () => {
  it.each([
    ["summer time, UTC+3", "2026-06-15", "18:00:00", "2026-06-15T15:00:00.000Z"],
    ["winter time, UTC+2", "2026-12-15", "18:00:00", "2026-12-15T16:00:00.000Z"],
    ["Metrix's real format", "2026-05-01", "06:00:00", "2026-05-01T03:00:00.000Z"],
    ["a time without seconds", "2026-10-03", "18:00", "2026-10-03T15:00:00.000Z"],
    ["midnight on the day DST ends (25 Oct 2026)", "2026-10-25", "00:00:00", "2026-10-24T21:00:00.000Z"],
    ["after DST ends the same day", "2026-10-25", "12:00:00", "2026-10-25T10:00:00.000Z"],
    ["after DST starts (29 Mar 2026)", "2026-03-29", "12:00:00", "2026-03-29T09:00:00.000Z"],
  ])("reads %s", (_, day, time, expected) => {
    expect(zonedTimeToInstant(day, time, HELSINKI).toISOString()).toBe(expected);
  });

  it("uses the round day's offset, not today's", () => {
    // A July round looked up in December still starts at UTC+3.
    expect(zonedTimeToInstant("2027-07-01", "10:00:00", HELSINKI).toISOString()).toBe("2027-07-01T07:00:00.000Z");
  });
});
