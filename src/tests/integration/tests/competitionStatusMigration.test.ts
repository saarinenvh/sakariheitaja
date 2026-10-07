import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;

let dataSource: DataSource;

// Prod has all three: followed rounds, finished ones, and old rows with no value.
beforeAll(async () => {
  dataSource = await startBotDatabase("competition_status_migration", `
    INSERT INTO chats (id, name) VALUES (${CHAT_ID}, 'Testi');
    INSERT INTO competitions (finished, chat_id, metrix_id) VALUES (0, ${CHAT_ID}, '1'), (1, ${CHAT_ID}, '2'), (NULL, ${CHAT_ID}, '3');
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

  it("keeps the status to its three words", async () => {
    const [column]: { Type: string }[] = await dataSource.query("SHOW COLUMNS FROM competitions LIKE 'status'");

    expect(column.Type).toBe("enum('following','finished','error')");
    await expect(dataSource.query("UPDATE competitions SET status = 'done' WHERE id = 1")).rejects.toThrow();
  });
});
