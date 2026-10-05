import { describe, expect, it } from "vitest";
import { errorBackoffMs, msUntilStart, quietPollIntervalMs, withJitter } from "../policy";

const intervals = { activeIntervalMs: 1_000, idleIntervalMs: 2_000, dormantIntervalMs: 4_000 };

describe("polling policy", () => {
  it("slows down from active to idle to dormant as quiet polls add up", () => {
    expect(quietPollIntervalMs(intervals, 0)).toBe(1_000);
    expect(quietPollIntervalMs(intervals, 2)).toBe(1_000);
    expect(quietPollIntervalMs(intervals, 3)).toBe(2_000);
    expect(quietPollIntervalMs(intervals, 9)).toBe(2_000);
    expect(quietPollIntervalMs(intervals, 10)).toBe(4_000);
  });

  it("doubles the backoff with each consecutive failure up to its maximum", () => {
    expect(errorBackoffMs(1)).toBe(60_000);
    expect(errorBackoffMs(2)).toBe(120_000);
    expect(errorBackoffMs(4)).toBe(480_000);
    expect(errorBackoffMs(5)).toBe(600_000);
    expect(errorBackoffMs(20)).toBe(600_000);
  });

  it("keeps the jittered interval within 15 % of the interval", () => {
    expect(withJitter(10_000, 0)).toBe(8_500);
    expect(withJitter(10_000, 0.5)).toBe(10_000);
    expect(withJitter(10_000, 0.999)).toBeLessThanOrEqual(11_500);
  });
});

describe("msUntilStart", () => {
  const now = new Date("2026-06-15T09:00:00Z");

  it("waits until the round starts", () => {
    // 18:00 Helsinki summer time is 15:00 UTC: six hours away, not three.
    expect(msUntilStart(new Date("2026-06-15T15:00:00Z"), now)).toBe(6 * 60 * 60 * 1000);
  });

  it("starts right away once the round has started, or without a start", () => {
    expect(msUntilStart(new Date("2026-06-15T08:00:00Z"), now)).toBe(0);
    expect(msUntilStart(null, now)).toBe(0);
  });
});
