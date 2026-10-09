import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GamePlan } from "../../../../features/games";

const mocks = vi.hoisted(() => ({
  listPlans: vi.fn(), listChatsWithBotPin: vi.fn(), editBotPin: vi.fn(), removeBotPin: vi.fn(),
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
}));
vi.mock("../../../../features/games", async () => ({
  listPlans: mocks.listPlans,
  formatPlanSummary: (await import("../../../../features/games/planSummary")).formatPlanSummary,
  PLAN_TIME_ZONE: "Europe/Helsinki",
}));
vi.mock("../../../../features/chats", () => ({ listChatsWithBotPin: mocks.listChatsWithBotPin }));
vi.mock("../../../botPin", () => ({ editBotPin: mocks.editBotPin, removeBotPin: mocks.removeBotPin }));
vi.mock("../../../../shared/logger", () => ({ moduleLogger: () => ({ info: mocks.info, warn: mocks.warn, error: mocks.error }) }));

import { msUntilNextRefresh, refreshAllPinnedLists, refreshPinnedList, startPinnedListRefresher } from "../pinnedList";
import type { PinApi } from "../../../botPin";
import { planningMessages as MSG } from "../messages";

const api = {} as PinApi;
const MINUTE_MS = 60_000;

function plan(id: number): GamePlan {
  return {
    id, chatId: -100, creatorTelegramId: 42, creatorName: "Ville", day: "2026-10-10", startTime: "09:00:00",
    courses: ["Keljo"], text: "la 9 Keljo", createdAt: new Date("2026-10-09T12:00:00Z"), players: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("msUntilNextRefresh", () => {
  it.each([
    ["an afternoon in summer time", "2026-10-09T12:00:00Z", "2026-10-09T21:01:00Z"],
    ["a minute before midnight", "2026-10-24T20:59:00Z", "2026-10-24T21:01:00Z"],
    ["just after the refresh, the night before summer time ends", "2026-10-24T21:01:30Z", "2026-10-25T22:01:00Z"],
    ["the night summer time starts", "2026-03-28T22:30:00Z", "2026-03-29T21:01:00Z"],
  ])("waits until tomorrow's 00:01 in Helsinki: %s", (_case, now, next) => {
    expect(msUntilNextRefresh(new Date(now))).toBe(new Date(next).getTime() - new Date(now).getTime());
  });
});

describe("refreshPinnedList", () => {
  it("edits the pin to the current list", async () => {
    mocks.listPlans.mockResolvedValue([plan(12)]);

    await refreshPinnedList(api, -100);

    expect(mocks.editBotPin).toHaveBeenCalledWith(api, -100, `${MSG.hepitHeader}\n\n12. la 10.10. klo 9.00 Keljo\n\n${MSG.hepitFooter}`);
    expect(mocks.removeBotPin).not.toHaveBeenCalled();
  });

  it("unpins when no plans are left", async () => {
    mocks.listPlans.mockResolvedValue([]);

    await refreshPinnedList(api, -100);

    expect(mocks.removeBotPin).toHaveBeenCalledWith(api, -100);
    expect(mocks.editBotPin).not.toHaveBeenCalled();
  });
});

describe("refreshAllPinnedLists", () => {
  it("refreshes every chat with a pin, and goes on past a failing one", async () => {
    mocks.listChatsWithBotPin.mockResolvedValue([-1, -2, -3]);
    mocks.listPlans.mockImplementation(async (chatId: number) => {
      if (chatId === -2) throw new Error("database gone");
      return chatId === -1 ? [plan(1)] : [];
    });

    await refreshAllPinnedLists(api);

    expect(mocks.editBotPin).toHaveBeenCalledWith(api, -1, expect.any(String));
    expect(mocks.removeBotPin).toHaveBeenCalledWith(api, -3);
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ chatId: -2 }), expect.any(String));
  });

  it("retries a chat's refresh through a transient database error", async () => {
    vi.useFakeTimers();
    const deadlock = Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK" });
    mocks.listChatsWithBotPin.mockResolvedValue([-3]);
    mocks.listPlans.mockResolvedValue([]);
    mocks.removeBotPin.mockRejectedValueOnce(deadlock);

    const refreshed = refreshAllPinnedLists(api);
    await vi.runAllTimersAsync();
    await refreshed;

    expect(mocks.removeBotPin).toHaveBeenCalledTimes(2);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("logs and returns when the chats can't be listed", async () => {
    mocks.listChatsWithBotPin.mockRejectedValue(new Error("database gone"));

    await expect(refreshAllPinnedLists(api)).resolves.toBeUndefined();

    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.listPlans).not.toHaveBeenCalled();
  });
});

describe("startPinnedListRefresher", () => {
  it("refreshes at once, then just after every midnight", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-09T20:00:00Z") });
    mocks.listChatsWithBotPin.mockResolvedValue([]);

    startPinnedListRefresher(api);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.listChatsWithBotPin).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS);
    expect(mocks.listChatsWithBotPin).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    expect(mocks.listChatsWithBotPin).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE_MS);
    expect(mocks.listChatsWithBotPin).toHaveBeenCalledTimes(3);
  });
});
