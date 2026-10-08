import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const PELIT = { id: -1001, name: "SakariPelit" };
const MAIN = { id: -1002, name: "Main" };
const VILLE = { telegramUserId: 42, name: "Ville" };
const OTHER_VILLE = { telegramUserId: 43, name: "Ville" };
/** Thursday 8.10.2026 at noon in Helsinki. */
const THURSDAY = new Date("2026-10-08T09:00:00Z");
const FRIDAY = new Date("2026-10-09T09:00:00Z");

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let games: typeof import("../../../features/games/games");

beforeAll(async () => {
  dataSource = await startBotDatabase("game_plans");
  games = await import("../../../features/games/games");
});

afterAll(async () => {
  await dataSource?.destroy();
});

/** Saves a plan in the fixed form and returns its number. */
async function plan(text: string, chat = PELIT, creator = VILLE, now = THURSDAY): Promise<number> {
  const result = await games.makePlan(chat, creator, text, now);
  if (result.kind !== "saved") throw new Error(`"${text}" wasn't saved: ${result.kind}`);

  return result.plan.id;
}

async function playerNames(planId: number): Promise<string[]> {
  const rows: { name: string }[] = await dataSource.query("SELECT name FROM game_plan_players WHERE plan_id = ? ORDER BY id", [planId]);

  return rows.map(row => row.name);
}

describe("making a plan", () => {
  it("stores the chat, and saves the plan with its creator as the first player", async () => {
    const result = await games.makePlan(PELIT, VILLE, "la klo 9.00 karjaa + härkälinna", THURSDAY);

    expect(result).toMatchObject({
      kind: "saved",
      plan: {
        chatId: PELIT.id, creatorTelegramId: 42, day: "2026-10-10", startTime: "09:00:00",
        courses: ["Karjaa", "Härkälinna"], players: [{ name: "Ville", telegramUserId: 42 }],
      },
    });
    const [chat]: { name: string }[] = await dataSource.query("SELECT name FROM chats WHERE id = ?", [PELIT.id]);
    expect(chat.name).toBe("SakariPelit");
  });

  it("keeps emoji in the plan's text", async () => {
    const planId = await plan("su Keljo ⛳🔥");

    const [row]: { text: string }[] = await dataSource.query("SELECT text FROM game_plans WHERE id = ?", [planId]);
    expect(row.text).toBe("su Keljo ⛳🔥");
  });
});

describe("plans per chat", () => {
  it("lists, joins and cancels only the chat's own plans", async () => {
    const planId = await plan("la Tali");

    expect((await games.listPlans(MAIN.id, THURSDAY)).map(found => found.id)).not.toContain(planId);
    await expect(games.joinPlan(MAIN.id, planId, { name: "Teppo", telegramUserId: null })).resolves.toEqual({ kind: "no-plan" });
    await expect(games.cancelPlan(MAIN.id, planId, VILLE.telegramUserId)).resolves.toEqual({ kind: "no-plan" });
    expect((await games.listPlans(PELIT.id, THURSDAY)).map(found => found.id)).toContain(planId);
  });
});

describe("joining", () => {
  it("lets two members with the same name both join, by their Telegram ids", async () => {
    const planId = await plan("la Keljo", PELIT, { telegramUserId: 50, name: "Jori" });

    await expect(games.joinPlan(PELIT.id, planId, VILLE)).resolves.toEqual({ kind: "joined" });
    await expect(games.joinPlan(PELIT.id, planId, OTHER_VILLE)).resolves.toEqual({ kind: "joined" });
    await expect(games.joinPlan(PELIT.id, planId, VILLE)).resolves.toEqual({ kind: "already" });
    expect(await playerNames(planId)).toEqual(["Jori", "Ville", "Ville"]);
  });

  it("keeps a name without an id once per plan, ignoring case but not accents", async () => {
    const planId = await plan("la Keljo");

    await expect(games.joinPlan(PELIT.id, planId, { name: "wiltzu", telegramUserId: null })).resolves.toEqual({ kind: "joined" });
    await expect(games.joinPlan(PELIT.id, planId, { name: "Wiltzu", telegramUserId: null })).resolves.toEqual({ kind: "already" });
    await expect(games.joinPlan(PELIT.id, planId, { name: "Mäki", telegramUserId: null })).resolves.toEqual({ kind: "joined" });
    await expect(games.joinPlan(PELIT.id, planId, { name: "Maki", telegramUserId: null })).resolves.toEqual({ kind: "joined" });
    expect(await playerNames(planId)).toEqual(["Ville", "wiltzu", "Mäki", "Maki"]);
  });

  it("refuses the same name twice even when both arrive at the same moment", async () => {
    const planId = await plan("la Keljo");
    const klasu = { name: "Klasu", telegramUserId: null };

    const results = await Promise.all([games.joinPlan(PELIT.id, planId, klasu), games.joinPlan(PELIT.id, planId, klasu)]);

    expect(results.map(result => result.kind).sort()).toEqual(["already", "joined"]);
    expect(await playerNames(planId)).toEqual(["Ville", "Klasu"]);
  });
});

describe("a name's length", () => {
  it("stores a name of 100 characters whole, and refuses a longer one instead of cutting it", async () => {
    const planId = await plan("la Keljo");

    await expect(games.joinPlan(PELIT.id, planId, { name: "a".repeat(100), telegramUserId: null })).resolves.toEqual({ kind: "joined" });
    await expect(games.joinPlan(PELIT.id, planId, { name: "b".repeat(101), telegramUserId: null }))
      .resolves.toEqual({ kind: "name-too-long", maxLength: 100 });
    expect(await playerNames(planId)).toEqual(["Ville", "a".repeat(100)]);
  });
});

describe("leaving", () => {
  it("removes a member by Telegram id, and a name only from the players without one", async () => {
    const planId = await plan("la Keljo");
    await games.joinPlan(PELIT.id, planId, { name: "Ville", telegramUserId: null });

    await expect(games.leavePlan(PELIT.id, planId, { kind: "name", name: "ville" })).resolves.toEqual({ kind: "left" });
    expect(await playerNames(planId)).toEqual(["Ville"]);
    await expect(games.leavePlan(PELIT.id, planId, { kind: "member", telegramUserId: 42 })).resolves.toEqual({ kind: "left" });
    await expect(games.leavePlan(PELIT.id, planId, { kind: "member", telegramUserId: 42 })).resolves.toEqual({ kind: "not-in-plan" });
    expect(await playerNames(planId)).toEqual([]);
  });
});

describe("cancelling", () => {
  it("is for the creator only, and takes the players with the plan", async () => {
    const planId = await plan("la Keljo");
    await games.joinPlan(PELIT.id, planId, { name: "Wiltzu", telegramUserId: null });

    await expect(games.cancelPlan(PELIT.id, planId, OTHER_VILLE.telegramUserId)).resolves.toEqual({ kind: "not-creator" });
    await expect(games.cancelPlan(PELIT.id, planId, VILLE.telegramUserId)).resolves.toEqual({ kind: "cancelled" });
    expect(await playerNames(planId)).toEqual([]);
  });
});

describe("the coming week's plans", () => {
  it("are the next seven days' from today on, in their own chat", async () => {
    const chat = { id: -1003, name: "Viikko" };
    await plan("tänään Keljo", chat);
    await plan("ke Tali", chat);
    await plan("15.10. Härkälinna", chat);
    await plan("16.10. Karjaa", chat);
    await plan("14.10. Keljo", chat, VILLE, new Date("2026-10-06T09:00:00Z"));

    // From Friday 9.10.: today and the next six days run to Thursday 15.10.
    const week = await games.listPlansForDays(chat.id, 7, FRIDAY);

    expect(week.map(found => [found.day, found.courses[0]])).toEqual([
      ["2026-10-14", "Tali"],
      ["2026-10-14", "Keljo"],
      ["2026-10-15", "Härkälinna"],
    ]);
  });
});

describe("past plans", () => {
  it("leave the list the next day, but stay stored", async () => {
    const planId = await plan("tänään Keljo");

    expect((await games.listPlans(PELIT.id, THURSDAY)).map(found => found.id)).toContain(planId);
    expect((await games.listPlans(PELIT.id, FRIDAY)).map(found => found.id)).not.toContain(planId);
    const [row]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM game_plans WHERE id = ?", [planId]);
    expect(Number(row.count)).toBe(1);
  });
});
