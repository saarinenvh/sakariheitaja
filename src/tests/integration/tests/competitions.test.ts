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

async function competitionRows(): Promise<{ id: number; day: string | null; finished: number }[]> {
  return dataSource.query("SELECT id, DATE_FORMAT(day, '%Y-%m-%d') AS day, finished FROM competitions ORDER BY id");
}

describe("chats", () => {
  it("stores a chat once, keeping its first name", async () => {
    await chats.addIfAbsent(CHAT_ID, "Testi");
    await chats.addIfAbsent(CHAT_ID, "Uusi nimi");

    await expect(chats.findById(CHAT_ID)).resolves.toEqual({ id: CHAT_ID, name: "Testi" });
  });
});

describe("competitions", () => {
  it("creates a followed round and returns its id", async () => {
    const { insertId } = await competitions.create(CHAT_ID, "3809486");

    expect(insertId).toBe(1);
    expect(await competitionRows()).toEqual([{ id: 1, day: null, finished: 0 }]);
  });

  it("saves the round's day once, keeping the first", async () => {
    await competitions.saveDay(1, "2026-10-03");
    await competitions.saveDay(1, "2026-10-04");

    expect((await competitionRows())[0].day).toBe("2026-10-03");
  });

  it("resumes only unfinished rounds that have a chat and a Metrix id", async () => {
    await competitions.create(CHAT_ID, "3809487");
    await competitions.markFinished(2);
    // A row from before the bot checked its columns: no Metrix id.
    await dataSource.query("INSERT INTO competitions (finished, chat_id) VALUES (0, ?)", [CHAT_ID]);

    await expect(competitions.findUnfinished()).resolves.toEqual([{ id: 1, chatId: CHAT_ID, metrixId: "3809486" }]);
  });

  it("keeps old rounds without a day", async () => {
    await dataSource.query("INSERT INTO competitions (finished, chat_id, metrix_id) VALUES (1, ?, '1000')", [CHAT_ID]);

    expect((await competitionRows()).at(-1)).toMatchObject({ day: null });
  });
});
