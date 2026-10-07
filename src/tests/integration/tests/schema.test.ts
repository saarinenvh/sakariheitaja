import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await startBotDatabase("schema");
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe("migrations on the prod schema", () => {
  it("all run at startup", async () => {
    const applied: { name: string }[] = await dataSource.query("SELECT name FROM migrations ORDER BY id");

    expect(applied.map(row => row.name)).toEqual(dataSource.migrations.map(migration => migration.name));
  });

  it("leave nothing to run on the next start", async () => {
    await expect(dataSource.showMigrations()).resolves.toBe(false);
  });

  it.each([
    ["aces", "uq_aces_player_hole"],
    ["player_to_chat", "uq_player_to_chat_player_chat"],
    ["players", "uq_players_name"],
    ["courses", "uq_courses_name"],
  ])("give %s its unique key %s", async (table, key) => {
    const [{ "Create Table": definition }]: { "Create Table": string }[] = await dataSource.query(`SHOW CREATE TABLE ${table}`);

    expect(definition).toContain(`UNIQUE KEY \`${key}\``);
  });
});

describe("BIGINT chat ids", () => {
  beforeAll(async () => {
    await dataSource.query("INSERT INTO chats (id, name) VALUES (?, 'Testi')", [CHAT_ID]);
    await dataSource.query("INSERT INTO competitions (finished, chat_id, metrix_id) VALUES (0, ?, '3809486')", [CHAT_ID]);
  });

  it("read as numbers through an entity and through a raw query", async () => {
    const [competition] = await dataSource.getRepository("Competition").find();
    const chat = await dataSource.getRepository("Chat").findOneBy({ id: CHAT_ID });
    const [raw]: { chat_id: unknown }[] = await dataSource.query("SELECT chat_id FROM competitions");

    expect([competition.chatId, chat?.id, raw.chat_id]).toEqual([CHAT_ID, CHAT_ID, CHAT_ID]);
  });
});
