import { beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaMessage } from "../../../shared/llm/ollamaClient";

const mocks = vi.hoisted(() => ({
  getData: vi.fn<() => Promise<unknown>>(),
  send: vi.fn<(chatId: number, text: string) => Promise<unknown>>(),
  generate: vi.fn<(messages: OllamaMessage[], jsonSchema: unknown, options: unknown) => Promise<string>>(),
  handlers: new Map<string, (input: unknown) => Promise<void>>(),
  markDone: vi.fn(), saveScores: vi.fn(), saveResults: vi.fn(), stop: vi.fn(),
}));

vi.mock("../../../bot/bot", () => ({ bot: { api: { sendMessage: mocks.send } } }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));
vi.mock("../../../shared/llm/ollamaClient", () => ({ generateStructured: mocks.generate, loadPrompt: () => "Sakke" }));
vi.mock("../../../db/repositories/PlayerRepository", () => ({ findByChatId: async () => [{ id: 1, name: "Matti" }] }));
vi.mock("../services/CompetitionService", () => ({ markDone: mocks.markDone }));
vi.mock("../services/CourseService", () => ({ getOrCreate: async () => ({ id: 2 }) }));
vi.mock("../services/ScoreService", () => ({
  saveRecordedScores: mocks.saveScores, saveResults: mocks.saveResults,
}));
vi.mock("../scores/playerProfiles", () => ({ updateProfiles: vi.fn(), buildProfileSnippet: () => undefined }));
vi.mock("../scores/bagtags", () => ({
  getMissingTagPlayers: () => [], computeAndApplySwaps: () => ({}), formatBagtagAnnouncement: () => "Tags",
}));
vi.mock("./poller", () => ({ default: class {
  constructor(private id: string) {}
  on(event: string, handler: (input: unknown) => Promise<void>): void {
    if (event === "data") mocks.handlers.set(this.id, handler);
  }
  start(): void {}
  stop(): void { mocks.stop(); }
  reportChanges(): void {}
} }));

import { Orchestrator } from "./orchestrator";

const batchReply = (text: string): string =>
  JSON.stringify({ opening: "Avaus.", players: [{ name: "Matti", text }], closing: "Loppu." });

function response(strokes: readonly (number | null)[], position = "11") {
  const holes = strokes.map(value => value === null ? [] : { Result: String(value), Diff: value - 3, PEN: 0 });
  return {
    Competition: {
      ID: "123", Name: "Test round", Date: "2026-09-27", CourseName: "Test course", Type: "2",
      Tracks: strokes.map((_, index) => ({ Number: String(index + 1), Par: "3" })),
      SubCompetitions: [] as unknown[],
      Results: [
        { Name: "Matti", UserID: "1", ClassName: "MA3", OrderNumber: position,
          Sum: strokes.reduce<number>((sum, score) => sum + (score ?? 0), 0), Diff: 0, PlayerResults: holes },
        ...Array.from({ length: 19 }, (_, index) => ({
          Name: `Other ${index}`, UserID: String(index + 2), ClassName: "MA3", OrderNumber: index + 1,
          Sum: 0, Diff: 0, PlayerResults: strokes.map(() => []),
        })),
      ],
    },
  };
}

async function poll(input: unknown): Promise<void> {
  const handler = mocks.handlers.get("123");
  if (!handler) throw new Error("Poller was not started");
  await handler(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  process.env.LLM_ENABLED = "true";
  mocks.getData.mockResolvedValue(response([null, null, null]));
  mocks.send.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue(batchReply("Matti, ihan jees."));
});

describe("poll to publication", () => {
  it("announces offsetting corrections even when the total does not change", async () => {
    mocks.getData.mockResolvedValue(response([3, 4, null]));
    const orchestrator = await new Orchestrator(1, "123", -100, true).init();
    await poll(response([4, 3, null]));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toContain("korjaus");
    expect(mocks.send.mock.calls[0][1]).toContain("Väylät 1, 2");
    orchestrator.stopFollowing();
  });

  it("uses numeric live positions in the footer and passes delivered narrative to the model", async () => {
    const orchestrator = await new Orchestrator(1, "123", -100, true).init();
    await poll(response([3, null, null], "11"));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    await poll(response([3, 4, null], "10"));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[1][1]).toContain("sija 10 ↑");
    const context = JSON.parse(mocks.generate.mock.calls[1][0][1].content);
    expect(context.recentMessages).toEqual(["Avaus.\nMatti, ihan jees.\nLoppu."]);
    expect(context.players[0]).toMatchObject({ position: 10, positionChange: "nousu 1" });
    expect(mocks.generate.mock.calls[1][2]).toMatchObject({ num_ctx: 16384 });
    orchestrator.stopFollowing();
  });

  it("reports removals and preserves the last valid snapshot after malformed polling data", async () => {
    mocks.getData.mockResolvedValue(response([3, null, null]));
    const orchestrator = await new Orchestrator(1, "123", -100, true).init();
    const snapshot = orchestrator.snapshot;
    await poll({ Competition: { Results: [] } });
    expect(orchestrator.snapshot).toBe(snapshot);
    await poll(response([null, null, null]));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toContain("poistettu");
    orchestrator.stopFollowing();
  });

  it("waits for the final commentary before applying completion side effects", async () => {
    let release: (text: string) => void = () => { throw new Error("Generation has not started"); };
    mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
    mocks.getData.mockResolvedValue(response([3, 3, null]));
    const orchestrator = await new Orchestrator(1, "123", -100, true).init();
    await poll(response([3, 3, 3]));
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    expect(mocks.markDone).not.toHaveBeenCalled();
    release(batchReply("Matti pelasi parin."));
    await vi.waitFor(() => expect(mocks.markDone).toHaveBeenCalledWith(1));
    expect(mocks.send.mock.calls[0][1]).toContain("Matti pelasi parin.");
    expect(orchestrator.following).toBe(false);
  });

  it("posts the results before the bagtag announcement at round end", async () => {
    mocks.getData.mockResolvedValue(response([3, 3, null]));
    await new Orchestrator(1, "123", -100, true).init();
    await poll(response([3, 3, 3]));
    await vi.waitFor(() => expect(mocks.send.mock.calls.map(call => call[1])).toContain("Tags"));
    const texts = mocks.send.mock.calls.map(call => call[1]);
    const endIndex = texts.findIndex(text => text.startsWith("Dodii"));
    expect(texts.slice(endIndex)).toEqual([
      expect.stringContaining("lopputulokset"), expect.stringContaining("Test round TOP-5"), "Tags",
    ]);
  });

  it("rejects parent competitions before starting a poller", async () => {
    const parent = response([null, null, null]);
    parent.Competition.SubCompetitions = [{ ID: "124" }];
    mocks.getData.mockResolvedValue(parent);
    const orchestrator = await new Orchestrator(1, "123", -100, true).init();
    expect(orchestrator.following).toBe(false);
    expect(orchestrator.initializationError).toContain("yksittäisiä kierroksia");
    expect(mocks.handlers.size).toBe(0);
  });
});
