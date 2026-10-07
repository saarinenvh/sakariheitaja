import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ markError: vi.fn(), findFollowing: vi.fn() }));
vi.mock("../db/competitionRepository", () => ({ markError: mocks.markError, findFollowing: mocks.findFollowing }));
vi.mock("../liveScoring", () => ({
  ScoreTracker: class {
    stopped = false;
    constructor(public id: number, public metrixId: string, public chatId: number) {}
    async start(): Promise<{ kind: "following" }> { return { kind: "following" }; }
    stopFollowing(): void { this.stopped = true; }
  },
}));

import { ResumableRound, resumeFollowedRounds, resumeRound } from "../roundResumer";
import { StartResult, TrackerDependencies } from "../liveScoring";
import * as registry from "../trackerRegistry";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** A round whose starts answer `results` in order, the last one from then on. */
function fakeRound(...results: StartResult[]): ResumableRound & { starts: number } {
  const round = {
    id: 7, metrixId: "3809486", stopped: false, starts: 0,
    start: async (): Promise<StartResult> => results[Math.min(round.starts++, results.length - 1)],
    stopFollowing: (): void => { round.stopped = true; },
  };
  return round;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.markError.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resuming a round", () => {
  it("is done once the round starts", async () => {
    const round = fakeRound({ kind: "following" });

    await resumeRound(round);

    expect(round.starts).toBe(1);
    expect(mocks.markError).not.toHaveBeenCalled();
  });

  it("retries while Metrix doesn't answer, backing off, and follows once it does", async () => {
    const round = fakeRound({ kind: "unavailable" }, { kind: "unavailable" }, { kind: "following" });
    const resumed = resumeRound(round);

    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    expect(round.starts).toBe(2);
    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    expect(round.starts).toBe(2);
    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    await resumed;

    expect(round.starts).toBe(3);
    expect(round.stopped).toBe(false);
    expect(mocks.markError).not.toHaveBeenCalled();
  });

  it("retries a start that throws", async () => {
    const round = fakeRound({ kind: "following" });
    const start = round.start;
    round.start = vi.fn().mockRejectedValueOnce(new Error("database offline")).mockImplementation(start);
    const resumed = resumeRound(round);

    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    await resumed;

    expect(round.start).toHaveBeenCalledTimes(2);
    expect(mocks.markError).not.toHaveBeenCalled();
  });

  it("gives up after six hours of no answer: stops the round and marks it as an error", async () => {
    const round = fakeRound({ kind: "unavailable" });
    const resumed = resumeRound(round);

    await vi.advanceTimersByTimeAsync(6 * HOUR_MS - MINUTE_MS);
    expect(mocks.markError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10 * MINUTE_MS);
    await resumed;

    expect(round.stopped).toBe(true);
    expect(mocks.markError).toHaveBeenCalledWith(7, expect.stringContaining("Metrix"), expect.any(Date));
  });

  it("gives up at once on a round Metrix rejects", async () => {
    const round = fakeRound({ kind: "invalid", error: new Error("not a round") });

    await resumeRound(round);

    expect(round.stopped).toBe(true);
    expect(mocks.markError).toHaveBeenCalledWith(7, "Error: not a round", expect.any(Date));
  });

  it("stops retrying once /lopeta has stopped the round, without marking it", async () => {
    const round = fakeRound({ kind: "unavailable" });
    const resumed = resumeRound(round);

    round.stopFollowing();
    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    await resumed;

    expect(round.starts).toBe(1);
    expect(mocks.markError).not.toHaveBeenCalled();
  });
});

describe("resuming every followed round", () => {
  // The resumer doesn't touch the dependencies; the fake tracker ignores them.
  const dependencies = {} as TrackerDependencies;

  it("resumes each round once, and marks a second row for the same round as a duplicate", async () => {
    mocks.findFollowing.mockResolvedValue([
      { id: 1, chatId: -100, metrixId: "3809486" },
      { id: 2, chatId: -200, metrixId: "3809486" },
      { id: 3, chatId: -100, metrixId: "3809486" },
    ]);

    await resumeFollowedRounds(dependencies);

    expect(registry.findTracked(-100, "3809486")?.id).toBe(1);
    expect(registry.findTracked(-200, "3809486")?.id).toBe(2);
    expect(mocks.markError).toHaveBeenCalledTimes(1);
    expect(mocks.markError).toHaveBeenCalledWith(3, "duplicate of competition 1", expect.any(Date));
  });

  it("goes on when marking a duplicate fails", async () => {
    mocks.findFollowing.mockResolvedValue([
      { id: 4, chatId: -300, metrixId: "1" },
      { id: 5, chatId: -300, metrixId: "1" },
      { id: 6, chatId: -300, metrixId: "2" },
    ]);
    mocks.markError.mockRejectedValueOnce(new Error("database offline"));

    await resumeFollowedRounds(dependencies);

    expect(registry.findTracked(-300, "2")?.id).toBe(6);
  });
});
