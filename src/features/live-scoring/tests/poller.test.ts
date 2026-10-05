import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Poller from "../poller";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Poller start", () => {
  it("waits for a start further away than one timer can, instead of polling at once", async () => {
    const fetchRound = vi.fn(async () => ({ kind: "unavailable" as const }));
    const poller = new Poller("123", fetchRound);

    poller.start(30 * DAY_MS);

    await vi.advanceTimersByTimeAsync(25 * DAY_MS);
    expect(fetchRound).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5 * DAY_MS);
    expect(fetchRound).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it("cancels a long wait on stop", async () => {
    const fetchRound = vi.fn(async () => ({ kind: "unavailable" as const }));
    const poller = new Poller("123", fetchRound);

    poller.start(30 * DAY_MS);
    await vi.advanceTimersByTimeAsync(26 * DAY_MS);
    poller.stop();

    await vi.advanceTimersByTimeAsync(10 * DAY_MS);
    expect(fetchRound).not.toHaveBeenCalled();
  });
});
