import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ syncSpecialScores: vi.fn() }));
vi.mock("../../score-records", () => ({ syncSpecialScores: mocks.syncSpecialScores }));

import { syncRoundSpecialScores } from "../specialScoreSync";
import { buildHoleScore, buildRound, buildScorecard, buildTrackedPlayer } from "../../../tests/fixtures/metrixRound";
import { TrackedRoundPlayer } from "../../../integrations/metrix/round/types";

const competition = { id: 55, chatId: -100 };
const round = buildRound({ courseName: "Kaatis", day: null });
const aceCard = buildScorecard(buildHoleScore({ strokes: 1, relativeToPar: -2 }));

function tracked(id: number): TrackedRoundPlayer {
  return buildTrackedPlayer(id, { scorecard: aceCard });
}

beforeEach(() => {
  mocks.syncSpecialScores.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("syncRoundSpecialScores", () => {
  it("syncs each tracked player's card in the competition", async () => {
    await syncRoundSpecialScores(competition, round, [tracked(1), tracked(2)]);

    expect(mocks.syncSpecialScores.mock.calls.map(([playerRound, played, card]) => [playerRound, played, card])).toEqual([
      [{ playerId: 1, chatId: -100, competitionId: 55 }, { courseName: "Kaatis", day: null }, aceCard],
      [{ playerId: 2, chatId: -100, competitionId: 55 }, { courseName: "Kaatis", day: null }, aceCard],
    ]);
  });

  it("retries through a transient error with the same time, even across midnight", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 27, 23, 59, 59, 500) });
    const deadlock = Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK" });
    mocks.syncSpecialScores.mockRejectedValueOnce(deadlock);

    const synced = syncRoundSpecialScores(competition, round, [tracked(1)]);
    await vi.runAllTimersAsync();
    await synced;

    const [failed, retried] = mocks.syncSpecialScores.mock.calls;
    expect(retried).toEqual(failed);
  });

  it("throws at the first player that still fails, without trying the rest", async () => {
    mocks.syncSpecialScores.mockRejectedValueOnce(new Error("database down"));

    await expect(syncRoundSpecialScores(competition, round, [tracked(1), tracked(2)])).rejects.toThrow("database down");
    expect(mocks.syncSpecialScores).toHaveBeenCalledTimes(1);
  });
});
