import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;

let dataSource: DataSource;

// Prod has followed rounds, finished ones, old rows with no `finished` value, and old rows with no Metrix id.
beforeAll(async () => {
  dataSource = await startBotDatabase("competition_migrations", `
    INSERT INTO chats (id, name) VALUES (${CHAT_ID}, 'Testi');
    INSERT INTO competitions (finished, chat_id, metrix_id)
      VALUES (0, ${CHAT_ID}, '1'), (1, ${CHAT_ID}, '2'), (NULL, ${CHAT_ID}, '3'), (0, ${CHAT_ID}, NULL);
  `);
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe("ReplaceCompetitionFinishedWithStatus", () => {
  it("resumes only the rounds that were unfinished, as before", async () => {
    const rows: { metrix_id: string; status: string }[] = await dataSource.query("SELECT metrix_id, status FROM competitions ORDER BY id");

    expect(rows).toEqual([
      { metrix_id: "1", status: "following" },
      { metrix_id: "2", status: "finished" },
      { metrix_id: "3", status: "finished" },
    ]);
  });

  it("drops the finished column", async () => {
    const columns: { Field: string }[] = await dataSource.query("SHOW COLUMNS FROM competitions");

    expect(columns.map(column => column.Field)).not.toContain("finished");
  });

  it("keeps the status to its four words", async () => {
    const [column]: { Type: string }[] = await dataSource.query("SHOW COLUMNS FROM competitions LIKE 'status'");

    expect(column.Type).toBe("enum('following','finished','error','stopped')");
    await expect(dataSource.query("UPDATE competitions SET status = 'done' WHERE id = 1")).rejects.toThrow();
  });
});

describe("MakeCompetitionChatAndMetrixRequired", () => {
  it("deletes the rows without a Metrix id", async () => {
    const [{ count }]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM competitions WHERE metrix_id IS NULL");

    expect(Number(count)).toBe(0);
  });

  it("requires a chat and a Metrix id from now on", async () => {
    const columns: { Field: string; Null: string }[] = await dataSource.query("SHOW COLUMNS FROM competitions WHERE Field IN ('chat_id', 'metrix_id')");

    expect(columns.map(column => [column.Field, column.Null])).toEqual([["chat_id", "NO"], ["metrix_id", "NO"]]);
  });
});
