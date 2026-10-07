import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;

let dataSource: DataSource;

// A /lisaa between the prod check and the deploy could link the same player twice.
beforeAll(async () => {
  dataSource = await startBotDatabase("link_migration", `
    INSERT INTO chats (id, name) VALUES (${CHAT_ID}, 'Testi');
    INSERT INTO players (name) VALUES ('Ville'), ('Jori');
    INSERT INTO player_to_chat (player_id, chat_id) VALUES (1, ${CHAT_ID}), (1, ${CHAT_ID}), (2, ${CHAT_ID}), (1, ${CHAT_ID});
  `);
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe("AddNameAndLinkUniqueKeys on a table with duplicate links", () => {
  it("keeps the oldest link of each player and chat, so the bot starts", async () => {
    const links: { id: number; player_id: number }[] = await dataSource.query("SELECT id, player_id FROM player_to_chat ORDER BY id");

    expect(links).toEqual([{ id: 1, player_id: 1 }, { id: 3, player_id: 2 }]);
  });
});
