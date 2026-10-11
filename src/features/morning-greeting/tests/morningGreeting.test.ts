import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPlansForDays: vi.fn() }));
vi.mock("../../games", async () => ({
  listPlansForDays: mocks.listPlansForDays,
  PLAN_TIME_ZONE: "Europe/Helsinki",
  formatPlanSummary: (await import("../../games/planSummary")).formatPlanSummary,
}));

import { MorningGreetingDependencies, sendMorningGreeting } from "../morningGreeting";
import { giphySearchWords } from "../phrases";
import { ChatMessenger } from "../../chatMessenger";
import { OllamaClient } from "../../../integrations/ollama/client";
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

interface Fakes {
  deps: MorningGreetingDependencies;
  sent: Sent[];
  generateStructured: ReturnType<typeof vi.fn>;
  searchGif: ReturnType<typeof vi.fn>;
}

function fakes(overrides: Partial<MorningGreetingDependencies> = {}): Fakes {
  const sent: Sent[] = [];
  const messenger: ChatMessenger = {
    sendText: async (_chatId, text) => { sent.push(["text", text]); },
    sendHtml: async (_chatId, html) => { sent.push(["html", html]); },
    sendAnimation: async (_chatId, url) => { sent.push(["animation", url]); },
  };
  const generateStructured = vi.fn().mockResolvedValue(JSON.stringify({ text: "Kaks pelaa tänään, muut lintsaa.", gifQuery: "party" }));
  const ollama: OllamaClient = { generate: vi.fn(), generateStructured };
  const searchGif = vi.fn(async (word: string) => `https://media.giphy.test/${word}.mp4`);
  const deps: MorningGreetingDependencies = {
    messenger, ollama, llmEnabled: true, gamesChatId: GAMES_CHAT,
    openWeather: { getCurrentWeather: vi.fn(), getCityWeather: vi.fn().mockResolvedValue({ kind: "observed", weather }) },
    giphy: { searchGif },
    ...overrides,
  };

  return { deps, sent, generateStructured, searchGif };
}

/** The facts the model was asked with. */
function factsSent(generateStructured: ReturnType<typeof vi.fn>): Record<string, unknown> {
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
    expect(sent[0][1]).toContain("&amp; tämmöstä keliä");
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
      openWeather: { getCurrentWeather: vi.fn(), getCityWeather: vi.fn().mockResolvedValue({ kind: "failed", reason: "weather down" }) },
    });

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent.map(([kind]) => kind)).toEqual(["text", "animation"]);
    expect(factsSent(generateStructured)).toMatchObject({ weather: null, todaysGames: [] });
  });

  it("sends the later parts when one fails to send", async () => {
    const { deps, sent } = fakes();
    deps.messenger.sendText = vi.fn().mockRejectedValue(new Error("Telegram down"));

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent).toEqual([["animation", "https://media.giphy.test/party.mp4"]]);
  });
});
