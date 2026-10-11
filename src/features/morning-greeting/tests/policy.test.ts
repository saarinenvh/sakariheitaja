import { describe, expect, it } from "vitest";
import { msUntilNextGreeting } from "../policy";

describe("msUntilNextGreeting", () => {
  it.each([
    ["before 09:00, today's greeting", "2026-10-11T04:30:00Z", "2026-10-11T06:00:00Z"],
    ["just after the greeting, tomorrow's", "2026-10-11T06:00:01Z", "2026-10-12T06:00:00Z"],
    ["the night summer time ends: the next 09:00 is 25 hours away", "2026-10-24T06:00:01Z", "2026-10-25T07:00:00Z"],
    ["the night summer time starts: the next 09:00 is 23 hours away", "2026-03-28T07:00:01Z", "2026-03-29T06:00:00Z"],
  ])("waits until 09:00 in Helsinki: %s", (_case, now, next) => {
    expect(msUntilNextGreeting(new Date(now))).toBe(new Date(next).getTime() - new Date(now).getTime());
  });
});
