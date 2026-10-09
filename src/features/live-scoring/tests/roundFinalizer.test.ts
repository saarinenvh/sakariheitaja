import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  saveResults: vi.fn<() => Promise<void>>(),
  getOrCreate: vi.fn<() => Promise<{ id: number } | null>>(),
}));

vi.mock("../db/competitionRepository", () => ({ markFinished: async () => { steps.push("done"); } }));
vi.mock("../../score-records", () => ({ saveResults: mocks.saveResults, getOrCreateCourse: mocks.getOrCreate }));
vi.mock("../../player-profiles", () => ({ updateProfiles: () => { steps.push("profiles"); } }));
vi.mock("../../bagtags", () => ({
  computeAndApplySwaps: () => { steps.push("bagtags"); return { swaps: [], unchanged: [], noTag: [] }; },
  selectBagtagParticipants: () => [], formatBagtagAnnouncement: () => "Tags",
}));

import { finishRound, RoundEnd } from "../roundFinalizer";
import { MetrixRound } from "../../../integrations/metrix/round/types";

const round: MetrixRound = {
  id: "123", name: "Viikkokisa", day: "2026-10-02", startsAt: null, courseName: "Testirata", courseId: null,
  layoutKey: "layout", holeLabels: ["1"], players: [],
};

const end: RoundEnd = {
  chatId: -100, competitionId: 55,
  messenger: {
    sendText: async (_chatId, text) => { steps.push(`text: ${text.slice(0, 5)}`); },
    sendHtml: async (_chatId, html) => { steps.push(`html: ${html}`); },
    sendVideo: async () => {},
  },
  sendTopList: async () => { steps.push("top list"); },
};

beforeEach(() => {
  steps.length = 0;
  mocks.saveResults.mockReset().mockImplementation(async () => { steps.push("results"); });
  mocks.getOrCreate.mockReset().mockResolvedValue({ id: 2 });
});

describe("finishRound", () => {
  it("saves everything before marking the competition done, then posts the results", async () => {
    await finishRound(end, round, []);
    expect(steps).toEqual(["text: Dodii", "results", "profiles", "bagtags", "done", "top list", "html: Tags"]);
  });

  it("leaves the competition unfinished when saving fails, so the round end runs again after a restart", async () => {
    mocks.saveResults.mockRejectedValue(new Error("database down"));
    await expect(finishRound(end, round, [])).rejects.toThrow("database down");
    expect(steps).not.toContain("done");
    expect(steps).not.toContain("top list");
  });

  it("retries results through a transient database error, sending the end message only once", async () => {
    vi.useFakeTimers();
    const deadlock = Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK" });
    mocks.saveResults.mockRejectedValueOnce(deadlock);

    const finished = finishRound(end, round, []);
    await vi.runAllTimersAsync();
    await finished;
    vi.useRealTimers();

    expect(mocks.saveResults).toHaveBeenCalledTimes(2);
    expect(steps).toEqual(["text: Dodii", "results", "profiles", "bagtags", "done", "top list", "html: Tags"]);
  });

  it("treats a missing course as a failure instead of finishing without results", async () => {
    mocks.getOrCreate.mockResolvedValue(null);
    await expect(finishRound(end, round, [])).rejects.toThrow("Course Testirata could not be saved");
    expect(steps).not.toContain("done");
  });
});
