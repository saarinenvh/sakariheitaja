import { GamePlan } from "../../features/games";

// A typed game plan for tests across modules, with valid defaults: a test spells out only what it is about.

/** Plan 12, Keljo on Saturday 2026-10-10 at 09:00, made by Ville; its players by name, without Telegram ids. */
export function buildGamePlan(overrides: Partial<GamePlan> = {}, playerNames: readonly string[] = []): GamePlan {
  const plan: GamePlan = {
    id: 12, chatId: -100, creatorTelegramId: 42, creatorName: "Ville", day: "2026-10-10", startTime: "09:00:00",
    courses: ["Keljo"], text: "la 9 Keljo", createdAt: new Date("2026-10-09T12:00:00Z"), players: [],
    ...overrides,
  };
  plan.players = playerNames.map((name, index) => ({ id: index + 1, planId: plan.id, name, telegramUserId: null, plan }));

  return plan;
}
