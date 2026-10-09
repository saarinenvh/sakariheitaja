import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let competitions: typeof import("../../../features/live-scoring/db/competitionRepository");
let chats: typeof import("../../../features/chats/db/chatRepository");

beforeAll(async () => {
  dataSource = await startBotDatabase("competitions");
  competitions = await import("../../../features/live-scoring/db/competitionRepository");
  chats = await import("../../../features/chats/db/chatRepository");
});

afterAll(async () => {
  await dataSource?.destroy();
});

async function competitionRows(): Promise<{ id: number; day: string | null; status: string }[]> {
  return dataSource.query("SELECT id, DATE_FORMAT(day, '%Y-%m-%d') AS day, status FROM competitions ORDER BY id");
}

describe("chats", () => {
  it("stores a chat once, keeping its first name", async () => {
    await chats.addIfAbsent(CHAT_ID, "Testi");
    await chats.addIfAbsent(CHAT_ID, "Uusi nimi");

    await expect(chats.findById(CHAT_ID)).resolves.toEqual({ id: CHAT_ID, name: "Testi", botPinnedMessageId: null });
  });

  it("remembers the bot's one pin, replaces it, and forgets it", async () => {
    await chats.addIfAbsent(CHAT_ID, "Testi");

    await chats.saveBotPin(CHAT_ID, 501);
    await chats.saveBotPin(CHAT_ID, 502);
    await expect(chats.findBotPin(CHAT_ID)).resolves.toBe(502);

    await chats.saveBotPin(CHAT_ID, null);
    await expect(chats.findBotPin(CHAT_ID)).resolves.toBeNull();
  });

  it("has no pin for a chat it doesn't know", async () => {
    await expect(chats.findBotPin(-1)).resolves.toBeNull();
  });

  it("lists only the chats with a pin", async () => {
    await chats.addIfAbsent(-7001, "Pinned");
    await chats.addIfAbsent(-7002, "Not pinned");
    await chats.saveBotPin(-7001, 601);

    const chatIds = await chats.listChatsWithBotPin();

    expect(chatIds).toContain(-7001);
    expect(chatIds).not.toContain(-7002);
  });
});

describe("competitions", () => {
  it("creates a followed round and returns its id", async () => {
    const { insertId } = await competitions.create(CHAT_ID, "3809486");

    expect(insertId).toBe(1);
    expect(await competitionRows()).toEqual([{ id: 1, day: null, status: "following" }]);
  });

  it("saves the round's day once, keeping the first", async () => {
    await competitions.saveDay(1, "2026-10-03");
    await competitions.saveDay(1, "2026-10-04");

    expect((await competitionRows())[0].day).toBe("2026-10-03");
  });

  it("resumes only followed rounds", async () => {
    await competitions.create(CHAT_ID, "3809487");
    await competitions.markFinished(2);

    await expect(competitions.findFollowing()).resolves.toEqual([{ id: 1, chatId: CHAT_ID, metrixId: "3809486" }]);
  });

  it("keeps old rounds without a day", async () => {
    await dataSource.query("INSERT INTO competitions (status, chat_id, metrix_id) VALUES ('finished', ?, '1000')", [CHAT_ID]);

    expect((await competitionRows()).at(-1)).toMatchObject({ day: null });
  });

  it("stops a round without deleting it or its special scores, and doesn't resume it", async () => {
    const { insertId } = await competitions.create(CHAT_ID, "3809488");
    await dataSource.query("INSERT INTO players (name) VALUES ('Ville')");
    await dataSource.query("INSERT INTO courses (name) VALUES ('Kaatis')");
    await dataSource.query(
      "INSERT INTO aces (date, player_id, chat_id, course_id, competition_id, hole_number) VALUES ('2026-10-09', 1, ?, 1, ?, 4)",
      [CHAT_ID, insertId],
    );

    await competitions.markStopped(insertId);

    expect((await competitionRows()).find(row => row.id === insertId)?.status).toBe("stopped");
    const [{ count }]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM aces WHERE competition_id = ?", [insertId]);
    expect(count).toBe(1);
    expect((await competitions.findFollowing()).map(round => round.id)).not.toContain(insertId);
  });

  it("marks a round as an error: no longer resumed, listed with when and why", async () => {
    const erroredAt = new Date("2026-10-07T09:30:00Z");

    await competitions.markError(1, "Error: not a round", erroredAt);

    await expect(competitions.findFollowing()).resolves.toEqual([]);
    await expect(competitions.findErrored()).resolves.toEqual([
      { id: 1, chatId: CHAT_ID, metrixId: "3809486", erroredAt, errorReason: "Error: not a round" },
    ]);
  });
});
