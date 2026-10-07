import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;
const OTHER_CHAT_ID = -344664650;

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let players: typeof import("../../../features/players");

beforeAll(async () => {
  dataSource = await startBotDatabase("players");
  players = await import("../../../features/players");

  await dataSource.query("INSERT INTO chats (id, name) VALUES (?, 'Testi'), (?, 'Toinen')", [CHAT_ID, OTHER_CHAT_ID]);
  // As in prod: a player stored in lower case.
  await dataSource.query("INSERT INTO players (name) VALUES ('ville')");
});

afterAll(async () => {
  await dataSource?.destroy();
});

async function playerRows(): Promise<string[]> {
  const rows: { name: string }[] = await dataSource.query("SELECT name FROM players ORDER BY id");
  return rows.map(row => row.name);
}

describe("/lisaa and /poista", () => {
  it("links a stored player to the chat, whatever the case of the name", async () => {
    await expect(players.addToGroup("Ville", CHAT_ID)).resolves.toEqual({ added: true });

    expect(await playerRows()).toEqual(["ville"]);
    expect((await players.getGroupPlayers(CHAT_ID)).map(player => player.name)).toEqual(["ville"]);
  });

  it("doesn't link the same player to the chat twice", async () => {
    await expect(players.addToGroup("VILLE", CHAT_ID)).resolves.toEqual({ added: false });

    expect(await players.getGroupPlayers(CHAT_ID)).toHaveLength(1);
  });

  it("adds a new player once, and keeps each chat's players apart", async () => {
    await expect(players.addToGroup("Jori", OTHER_CHAT_ID)).resolves.toEqual({ added: true });
    await expect(players.addToGroup("jori", CHAT_ID)).resolves.toEqual({ added: true });

    expect(await playerRows()).toEqual(["ville", "Jori"]);
    expect((await players.getGroupPlayers(OTHER_CHAT_ID)).map(player => player.name)).toEqual(["Jori"]);
  });

  it("unlinks a player from one chat only", async () => {
    await expect(players.removeFromGroup("jori", CHAT_ID)).resolves.toEqual({ found: true, removed: true });
    await expect(players.removeFromGroup("jori", CHAT_ID)).resolves.toEqual({ found: true, removed: false });

    expect((await players.getGroupPlayers(OTHER_CHAT_ID)).map(player => player.name)).toEqual(["Jori"]);
  });

  it("reports an unknown player", async () => {
    await expect(players.removeFromGroup("Pekka", CHAT_ID)).resolves.toEqual({ found: false, removed: false });
  });
});
