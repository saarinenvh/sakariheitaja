import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPlansForDays: vi.fn() }));
vi.mock("../../games", async () => ({
  listPlansForDays: mocks.listPlansForDays,
  PLAN_TIME_ZONE: "Europe/Helsinki",
  formatPlanSummary: (await import("../../games/planSummary")).formatPlanSummary,
}));

import { MorningGreetingDependencies, sendMorningGreeting, startMorningGreeter } from "../morningGreeting";
import { giphySearchWords } from "../phrases";
import { ChatMessenger } from "../../chatMessenger";
import { OllamaClient } from "../../../integrations/ollama/client";
import { GiphyClient } from "../../../integrations/giphy/client";
import { OpenWeatherApi } from "../../../integrations/openweather/api";
import { buildGamePlan } from "../../../tests/fixtures/gamePlans";
import { buildCityWeather } from "../../../tests/fixtures/weather";

const MAIN_CHAT = -1;
const GAMES_CHAT = -2;
/** Saturday 2026-10-10, 09:00 in Helsinki. */
const NOW = new Date("2026-10-10T06:00:00Z");

const weather = buildCityWeather();
const todaysGame = buildGamePlan({ id: 12, day: "2026-10-10", startTime: "11:00:00" }, ["Ville", "Wiltzu"]);
const sundaysGame = buildGamePlan({ id: 13, day: "2026-10-11", startTime: null, courses: ["Karjaa"] }, ["Matti"]);

type Sent = [kind: "text" | "html" | "animation", content: string];

type GenerateStructured = ReturnType<typeof vi.fn<OllamaClient["generateStructured"]>>;

/** A messenger that records what it sends; `failing` kinds reject instead. */
function recordingMessenger(sent: Sent[], failing: readonly Sent[0][] = []): ChatMessenger {
  const send = (kind: Sent[0]) => async (_chatId: number, content: string): Promise<void> => {
    if (failing.includes(kind)) throw new Error(`Telegram refused the ${kind}`);
    sent.push([kind, content]);
  };

  return { sendText: send("text"), sendHtml: send("html"), sendAnimation: send("animation") };
}

function fakes(overrides: Partial<MorningGreetingDependencies> = {}, failing: readonly Sent[0][] = []) {
  const sent: Sent[] = [];
  const generateStructured: GenerateStructured = vi.fn<OllamaClient["generateStructured"]>()
    .mockResolvedValue(JSON.stringify({ text: "Kaks pelaa tänään, muut lintsaa.", gifQuery: "party" }));
  const searchGif = vi.fn<GiphyClient["searchGif"]>(async word => `https://media.giphy.test/${word}.mp4`);
  const getCityWeather = vi.fn<OpenWeatherApi["getCityWeather"]>().mockResolvedValue({ kind: "observed", weather });
  const deps: MorningGreetingDependencies = {
    messenger: recordingMessenger(sent, failing), llmEnabled: true, gamesChatId: GAMES_CHAT,
    ollama: { generate: vi.fn<OllamaClient["generate"]>(), generateStructured },
    openWeather: { getCurrentWeather: vi.fn<OpenWeatherApi["getCurrentWeather"]>(), getCityWeather },
    giphy: { searchGif },
    ...overrides,
  };

  return { deps, sent, generateStructured, searchGif, getCityWeather };
}

/** The facts the model was asked with. */
function factsSent(generateStructured: GenerateStructured): Record<string, unknown> {
  return JSON.parse(generateStructured.mock.calls[0][0][1].content);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  mocks.listPlansForDays.mockReset().mockResolvedValue([todaysGame, sundaysGame]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the morning greeting", () => {
  it("sends Sakke's greeting, the week's games, and a gif found with the model's word", async () => {
    const { deps, sent, generateStructured, searchGif } = fakes();

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent[0]).toEqual(["text", "Kaks pelaa tänään, muut lintsaa."]);
    expect(sent[1][0]).toBe("text");
    expect(sent[1][1]).toContain("12. la 10.10. klo 11.00 Keljo — Ville, Wiltzu");
    expect(sent[1][1]).toContain("13. su 11.10. Karjaa — Matti");
    expect(sent[2]).toEqual(["animation", "https://media.giphy.test/party.mp4"]);
    expect(sent).toHaveLength(3);
    expect(searchGif).toHaveBeenCalledWith("party");
    expect(mocks.listPlansForDays).toHaveBeenCalledWith(GAMES_CHAT, 7, NOW);
    expect(factsSent(generateStructured)).toMatchObject({
      weekday: "lauantai", date: "2026-10-10", todaysGames: [{ players: 2 }],
      weather: { town: "Helsinki", temperatureC: 9, windMs: 3, description: "pilvistä" },
    });
  });

  it("sends the canned greeting with the weather card when the model is off, and a gif from the word list", async () => {
    const { deps, sent, generateStructured, searchGif } = fakes({ llmEnabled: false });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(generateStructured).not.toHaveBeenCalled();
    expect(sent.map(([kind]) => kind)).toEqual(["html", "html", "text", "animation"]);
    expect(sent[0][1]).toContain("Kello on <b>9:00</b> &amp; tämmöstä keliä");
    expect(sent[1][1]).toContain("Helsinki");
    expect(giphySearchWords).toContain(searchGif.mock.calls[0][0]);
  });

  it("sends the canned greeting when the model fails", async () => {
    const { deps, sent, generateStructured } = fakes();
    generateStructured.mockRejectedValue(new Error("Ollama timed out"));

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent.map(([kind]) => kind)).toEqual(["html", "html", "text", "animation"]);
  });

  it("has no games part, and tells the model of no games, without a planning group", async () => {
    const { deps, sent, generateStructured } = fakes({ gamesChatId: undefined });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(mocks.listPlansForDays).not.toHaveBeenCalled();
    expect(sent.map(([kind]) => kind)).toEqual(["text", "animation"]);
    expect(factsSent(generateStructured)).toMatchObject({ todaysGames: [] });
  });

  it("still greets when the plans or the weather can't be read", async () => {
    mocks.listPlansForDays.mockRejectedValue(new Error("database offline"));
    const { deps, sent, generateStructured } = fakes({
      openWeather: {
        getCurrentWeather: vi.fn<OpenWeatherApi["getCurrentWeather"]>(),
        getCityWeather: vi.fn<OpenWeatherApi["getCityWeather"]>().mockResolvedValue({ kind: "failed", reason: "weather down" }),
      },
    });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent.map(([kind]) => kind)).toEqual(["text", "animation"]);
    expect(factsSent(generateStructured)).toMatchObject({ weather: null, todaysGames: [] });
  });

  it("sends the later parts when one fails to send", async () => {
    const { deps, sent } = fakes({}, ["text"]);

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent).toEqual([["animation", "https://media.giphy.test/party.mp4"]]);
  });

  it("sends the weather card even when the canned greeting fails to send", async () => {
    const sent: Sent[] = [];
    const messenger = recordingMessenger(sent);
    const sendHtml = vi.fn<ChatMessenger["sendHtml"]>()
      .mockRejectedValueOnce(new Error("Telegram refused the greeting"))
      .mockImplementation(messenger.sendHtml);
    const { deps } = fakes({ llmEnabled: false, messenger: { ...messenger, sendHtml } });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent.map(([kind]) => kind)).toEqual(["html", "text", "animation"]);
    expect(sent[0][1]).toContain("Helsinki");
  });

  it("still greets when the weather client throws", async () => {
    const getCityWeather = vi.fn<OpenWeatherApi["getCityWeather"]>().mockRejectedValue(new Error("weather client threw"));
    const { deps, sent, generateStructured } = fakes({ openWeather: { getCurrentWeather: vi.fn<OpenWeatherApi["getCurrentWeather"]>(), getCityWeather } });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent[0]).toEqual(["text", "Kaks pelaa tänään, muut lintsaa."]);
    expect(factsSent(generateStructured)).toMatchObject({ weather: null });
  });
});

describe("the morning greeter", () => {
  it("schedules the next day's greeting even when one fails outright", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-10T05:59:00Z") });
    // A plan without its players makes the facts throw, so the whole greeting fails.
    mocks.listPlansForDays.mockResolvedValue([{ day: "2026-10-10" }]);
    const { deps } = fakes();

    startMorningGreeter(deps, MAIN_CHAT);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.listPlansForDays).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(mocks.listPlansForDays).toHaveBeenCalledTimes(2);
  });
});
