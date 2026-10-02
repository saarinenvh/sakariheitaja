import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  saveResults: vi.fn<() => Promise<void>>(),
}));

vi.mock("../disc-golf/services/CompetitionService", () => ({ markDone: async () => { steps.push("done"); } }));
vi.mock("../disc-golf/services/CourseService", () => ({ getOrCreate: async () => ({ id: 2 }) }));
vi.mock("../disc-golf/services/ScoreService", () => ({ saveResults: mocks.saveResults }));
vi.mock("../disc-golf/scores/playerProfiles", () => ({ updateProfiles: () => { steps.push("profiles"); } }));
vi.mock("../disc-golf/scores/bagtags", () => ({
  computeAndApplySwaps: () => { steps.push("bagtags"); return { swaps: [], unchanged: [], noTag: [] }; },
  selectBagtagParticipants: () => [],
  formatBagtagAnnouncement: () => "Tags",
}));

import { finishRound, RoundEnd } from "./roundFinalizer";
import { MetrixRound } from "../../integrations/metrix/round/types";

const round: MetrixRound = {
  id: "123", name: "Viikkokisa", date: "2026-10-02", courseName: "Testirata", courseId: null,
  layoutKey: "layout", holeLabels: ["1"], players: [],
};

const end: RoundEnd = {
  chatId: -100, competitionId: 55,
  messenger: {
    sendText: async (_chatId, text) => { steps.push(`text: ${text.slice(0, 5)}`); },
    sendHtml: async (_chatId, html) => { steps.push(`html: ${html}`); },
  },
  sendTopList: async () => { steps.push("top list"); },
};

beforeEach(() => {
  steps.length = 0;
  mocks.saveResults.mockReset().mockImplementation(async () => { steps.push("results"); });
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
});
