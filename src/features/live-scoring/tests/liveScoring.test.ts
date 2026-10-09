import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaMessage } from "../../../integrations/ollama/client";

const mocks = vi.hoisted(() => ({
  getData: vi.fn<() => Promise<unknown>>(),
  send: vi.fn<(chatId: number, text: string) => Promise<void>>(),
  generate: vi.fn<(messages: OllamaMessage[], jsonSchema: unknown, options: unknown) => Promise<string>>(),
  handlers: new Map<string, (result: RoundFetchResult) => Promise<void>>(),
  markDone: vi.fn(), saveDay: vi.fn(), updateSpecialScores: vi.fn(), saveResults: vi.fn(), stop: vi.fn(),
}));

vi.mock("../../../prompts/prompts", () => ({ loadPrompt: () => "Sakke", loadContext: () => "" }));
vi.mock("../../players", () => ({ findByChatId: async () => [{ id: 1, name: "Matti" }], Player: class Player {} }));
vi.mock("../db/competitionRepository", () => ({ markFinished: mocks.markDone, saveDay: mocks.saveDay }));
vi.mock("../../score-records", () => ({
  updateSpecialScores: mocks.updateSpecialScores, saveResults: mocks.saveResults, getOrCreateCourse: async () => ({ id: 2 }),
}));
vi.mock("../../player-profiles", () => ({ updateProfiles: vi.fn() }));
vi.mock("../../bagtags", () => ({
  getMissingTagPlayers: () => [], computeAndApplySwaps: () => ({}),
  selectBagtagParticipants: () => [], formatBagtagAnnouncement: () => "Tags",
}));
vi.mock("../poller", () => ({ default: class {
  constructor(private id: string) {}
  on(event: string, handler: (result: RoundFetchResult) => Promise<void>): void {
    if (event === "data") mocks.handlers.set(this.id, handler);
  }
  start(): void {}
  stop(): void { mocks.stop(); }
  reportChanges(): void {}
} }));

import { ScoreTracker, TrackerDependencies } from "../liveScoring";
import { UnsupportedRoundError } from "../../../integrations/metrix/round/normalize";
import { ChatMessenger } from "../../chatMessenger";
import { MetrixClient, readRoundPayload, RoundFetchResult } from "../../../integrations/metrix/client";
import { OpenWeatherClient } from "../../../integrations/openweather/client";

const messenger: ChatMessenger = { sendText: mocks.send, sendHtml: mocks.send, sendVideo: vi.fn() };
const openWeather: OpenWeatherClient = { getCurrentWeather: vi.fn(), getCityWeather: vi.fn() };
const metrix: MetrixClient = {
  getRound: async roundId => readRoundPayload(await mocks.getData(), roundId),
  getCourseDetails: async () => ({ kind: "unconfigured" }),
  getCourseStatistics: async () => ({ kind: "not-found" }),
  findCourseLocation: async () => ({ kind: "not-found" }),
};

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

const dependencies: TrackerDependencies = {
  messenger, metrix, openWeather, ollama: { generate: vi.fn(), generateStructured: mocks.generate },
};

/** A resumed round by default: its players were announced already. */
function newTracker(playersAnnounced = true): ScoreTracker {
  return new ScoreTracker(1, "123", -100, dependencies, playersAnnounced);
}

async function startTracker(): Promise<ScoreTracker> {
  const tracker = newTracker();
  await tracker.start();
  return tracker;
}

async function poll(input: unknown): Promise<void> {
  const handler = mocks.handlers.get("123");
  if (!handler) throw new Error("Poller was not started");
  await handler(readRoundPayload(input, "123"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  process.env.LLM_ENABLED = "true";
  mocks.getData.mockResolvedValue(response([null, null, null]));
  mocks.send.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue(batchReply("Matti, ihan jees."));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("poll to publication", () => {
  it("saves the round's day from the first fetch", async () => {
    const tracker = await startTracker();

    expect(mocks.saveDay).toHaveBeenCalledWith(1, "2026-09-27");
    tracker.stopFollowing();
  });

  it("follows the round even when saving its day fails", async () => {
    mocks.saveDay.mockRejectedValueOnce(new Error("database offline"));

    const tracker = await startTracker();

    expect(tracker.phase).toBe("following");
    tracker.stopFollowing();
  });

  it("saves a special score through a transient database error", async () => {
    const tracker = await startTracker();
    const deadlock = Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK" });
    mocks.updateSpecialScores.mockClear().mockRejectedValueOnce(deadlock);
    vi.useFakeTimers();

    await poll(response([1, null, null]));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));

    const [failed, retried] = mocks.updateSpecialScores.mock.calls;
    expect(mocks.updateSpecialScores).toHaveBeenCalledTimes(2);
    expect(retried).toEqual(failed);
    tracker.stopFollowing();
  });

  it("finds a /score player ignoring case, and none when the name is ambiguous", async () => {
    const tracker = await startTracker();
    expect(tracker.getScoreByPlayerName("matti")?.name).toBe("Matti");

    const twoMattis = response([null, null, null]);
    twoMattis.Competition.Results[1] = { ...twoMattis.Competition.Results[1], Name: "MATTI" };
    await poll(twoMattis);
    expect(tracker.getScoreByPlayerName("matti")).toBeUndefined();

    tracker.stopFollowing();
  });

  it("announces offsetting corrections even when the total does not change", async () => {
    mocks.getData.mockResolvedValue(response([3, 4, null]));
    const tracker = await startTracker();
    await poll(response([4, 3, null]));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toContain("korjaus");
    expect(mocks.send.mock.calls[0][1]).toContain("Väylät 1, 2");
    tracker.stopFollowing();
  });

  it("uses numeric live positions in the footer and passes delivered narrative to the model", async () => {
    const tracker = await startTracker();
    await poll(response([3, null, null], "11"));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    await poll(response([3, 4, null], "10"));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[1][1]).toContain("sija 10 ↑");
    const context = JSON.parse(mocks.generate.mock.calls[1][0][1].content);
    expect(context.recentMessages).toEqual(["Avaus.\nMatti, ihan jees.\nLoppu."]);
    expect(context.players[0]).toMatchObject({ position: 10, positionChange: "nousu 1" });
    expect(mocks.generate.mock.calls[1][2]).toMatchObject({ num_ctx: 16384 });
    tracker.stopFollowing();
  });

  it("reports removals and preserves the last valid snapshot after malformed polling data", async () => {
    mocks.getData.mockResolvedValue(response([3, null, null]));
    const tracker = await startTracker();
    const snapshot = tracker.snapshot;
    await poll({ Competition: { Results: [] } });
    expect(tracker.snapshot).toBe(snapshot);
    await poll(response([null, null, null]));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(mocks.send.mock.calls[0][1]).toContain("poistettu");
    tracker.stopFollowing();
  });

  it("waits for the final commentary before applying completion side effects", async () => {
    let release: (text: string) => void = () => { throw new Error("Generation has not started"); };
    mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
    mocks.getData.mockResolvedValue(response([3, 3, null]));
    const tracker = await startTracker();
    await poll(response([3, 3, 3]));
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    expect(mocks.markDone).not.toHaveBeenCalled();
    release(batchReply("Matti pelasi parin."));
    await vi.waitFor(() => expect(mocks.markDone).toHaveBeenCalledWith(1));
    expect(mocks.send.mock.calls[0][1]).toContain("Matti pelasi parin.");
    expect(tracker.phase).toBe("stopped");
  });

  it("posts the results before the bagtag announcement at round end", async () => {
    mocks.getData.mockResolvedValue(response([3, 3, null]));
    await startTracker();
    await poll(response([3, 3, 3]));
    await vi.waitFor(() => expect(mocks.send.mock.calls.map(call => call[1])).toContain("Tags"));
    const texts = mocks.send.mock.calls.map(call => call[1]);
    const endIndex = texts.findIndex(text => text.startsWith("Dodii"));
    expect(texts.slice(endIndex)).toEqual([
      expect.stringContaining("lopputulokset"), expect.stringContaining("Test round TOP-5"), "Tags",
    ]);
  });

});

describe("starting", () => {
  it("rejects parent competitions before starting a poller", async () => {
    const parent = response([null, null, null]);
    parent.Competition.SubCompetitions = [{ ID: "124" }];
    mocks.getData.mockResolvedValue(parent);

    const result = await newTracker().start();

    expect(result).toEqual({ kind: "invalid", error: expect.any(UnsupportedRoundError) });
    expect(mocks.handlers.size).toBe(0);
  });

  it("stays startable when Metrix doesn't answer, and starts on the next try", async () => {
    vi.spyOn(metrix, "getRound").mockResolvedValueOnce({ kind: "unavailable" });
    const tracker = newTracker();

    await expect(tracker.start()).resolves.toEqual({ kind: "unavailable" });
    expect(tracker.phase).toBe("starting");

    await expect(tracker.start()).resolves.toEqual({ kind: "following" });
    expect(tracker.phase).toBe("following");
    tracker.stopFollowing();
  });

  it("is scheduled until the round's start time, then following", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
    const tracker = await startTracker();

    expect(tracker.phase).toBe("scheduled");
    expect(tracker.started).toBe(true);

    vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
    expect(tracker.phase).toBe("following");

    tracker.stopFollowing();
    vi.useRealTimers();
  });

  it("doesn't start polling a round stopped while it was starting", async () => {
    const tracker = newTracker();
    mocks.saveDay.mockImplementationOnce(async () => tracker.stopFollowing());

    await expect(tracker.start()).resolves.toEqual({ kind: "stopped" });
    expect(mocks.handlers.size).toBe(0);
  });

  it("says when a new round has no tracked players, without sending anything itself", async () => {
    const withoutMatti = response([null, null, null]);
    withoutMatti.Competition.Results[0] = { ...withoutMatti.Competition.Results[0], Name: "Pekka" };
    mocks.getData.mockResolvedValue(withoutMatti);

    await expect(newTracker(false).start()).resolves.toEqual({ kind: "no-players" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
