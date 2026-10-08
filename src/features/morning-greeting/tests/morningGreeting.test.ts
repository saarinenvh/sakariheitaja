import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GamePlan } from "../../games";

const mocks = vi.hoisted(() => ({ listPlansForDays: vi.fn() }));
vi.mock("../../games", async () => ({
  listPlansForDays: mocks.listPlansForDays,
  PLAN_TIME_ZONE: "Europe/Helsinki",
  formatPlanSummary: (await import("../../games/planSummary")).formatPlanSummary,
}));
vi.mock("../../weather-report", () => ({
  cities: ["Lahti"],
  buildCityWeatherReport: async () => ({ kind: "found", html: "Lahti: 12°C" }),
}));

import { MorningGreetingDependencies, sendMorningGreeting } from "../morningGreeting";
import { morningCallToAction } from "../messages";
import { ChatMessenger } from "../../chatMessenger";

const MAIN_CHAT = -1;
const GAMES_CHAT = -2;

function greetingDependencies(gamesChatId: number | undefined): { deps: MorningGreetingDependencies; sent: string[] } {
  const sent: string[] = [];
  const record = async (_chatId: number, text: string): Promise<void> => { sent.push(text); };
  const messenger: ChatMessenger = { sendText: record, sendHtml: record, sendVideo: record };
  // The greeting only uses the weather through buildCityWeatherReport, mocked above.
  const deps = {
    messenger, openWeather: {} as MorningGreetingDependencies["openWeather"],
    giphy: { searchGif: async () => null }, gamesChatId,
  };

  return { deps, sent };
}

function plan(id: number, day: string): GamePlan {
  return { id, day, startTime: "18:00:00", courses: ["Keljo"], players: [{ name: "Ville" }] } as GamePlan;
}

beforeEach(() => {
  mocks.listPlansForDays.mockReset();
});

describe("the morning greeting's games", () => {
  it("lists the planning group's next seven days after the weather", async () => {
    mocks.listPlansForDays.mockResolvedValue([plan(12, "2026-10-14")]);
    const { deps, sent } = greetingDependencies(GAMES_CHAT);

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(mocks.listPlansForDays).toHaveBeenCalledWith(GAMES_CHAT, 7, expect.any(Date));
    expect(sent[1]).toBe("Lahti: 12°C");
    expect(sent[2]).toContain("12. ke 14.10. klo 18.00 Keljo — Ville");
    expect(sent[3]).toBe(morningCallToAction);
  });

  it("has no games part without plans", async () => {
    mocks.listPlansForDays.mockResolvedValue([]);
    const { deps, sent } = greetingDependencies(GAMES_CHAT);

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent).toHaveLength(3);
  });

  it("doesn't look for plans without a planning group", async () => {
    const { deps, sent } = greetingDependencies(undefined);

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(mocks.listPlansForDays).not.toHaveBeenCalled();
    expect(sent).toHaveLength(3);
  });

  it("still sends the other parts when the plans can't be read", async () => {
    mocks.listPlansForDays.mockRejectedValue(new Error("database offline"));
    const { deps, sent } = greetingDependencies(GAMES_CHAT);

    await sendMorningGreeting(deps, MAIN_CHAT);

    expect(sent).toHaveLength(3);
    expect(sent.at(-1)).toBe(morningCallToAction);
  });
});
