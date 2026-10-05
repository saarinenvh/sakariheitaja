import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;
const OTHER_CHAT_ID = -344664650;

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let scoreRecords: typeof import("../../../features/score-records");

beforeAll(async () => {
  dataSource = await startBotDatabase("results");
  scoreRecords = await import("../../../features/score-records");

  await dataSource.query("INSERT INTO chats (id, name) VALUES (?, 'Testi'), (?, 'Toinen')", [CHAT_ID, OTHER_CHAT_ID]);
  await dataSource.query("INSERT INTO players (name) VALUES ('Ville'), ('Jori')");
  await dataSource.query("INSERT INTO courses (name) VALUES ('Kaatis A'), ('Kaatis B'), ('Talin frisbeegolfrata')");
  await dataSource.query(
    "INSERT INTO competitions (finished, chat_id, metrix_id) VALUES (1, ?, '1'), (1, ?, '2'), (1, ?, '3')", [CHAT_ID, OTHER_CHAT_ID, CHAT_ID],
  );

  // The round end saves through the same function; one round per course here.
  await scoreRecords.saveResults([{ playerId: 1, strokes: 57, relativeToPar: 3 }, { playerId: 2, strokes: 52, relativeToPar: -2 }], CHAT_ID, 1, 1);
  await scoreRecords.saveResults([{ playerId: 1, strokes: 50, relativeToPar: -4 }], CHAT_ID, 3, 3);
  // Kaatis B has results in the other chat only.
  await scoreRecords.saveResults([{ playerId: 1, strokes: 50, relativeToPar: -4 }], OTHER_CHAT_ID, 2, 2);
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe("/tulokset", () => {
  it("lists a course's results in the chat, best first", async () => {
    await expect(scoreRecords.findCourseResults(CHAT_ID, "kaatis")).resolves.toEqual({
      kind: "results", course: "Kaatis A",
      results: [{ player: "Jori", relativeToPar: -2, strokes: 52 }, { player: "Ville", relativeToPar: 3, strokes: 57 }],
    });
  });

  it("asks which course only among the courses with results in this chat", async () => {
    await expect(scoreRecords.findCourseResults(OTHER_CHAT_ID, "kaatis")).resolves.toMatchObject({ kind: "results", course: "Kaatis B" });

    await scoreRecords.saveResults([{ playerId: 2, strokes: 55, relativeToPar: 1 }], OTHER_CHAT_ID, 1, 2);
    await expect(scoreRecords.findCourseResults(OTHER_CHAT_ID, "kaatis")).resolves.toEqual({
      kind: "ambiguous-course", courses: [{ id: 1, name: "Kaatis A" }, { id: 2, name: "Kaatis B" }],
    });
  });

  it("takes a course id", async () => {
    await expect(scoreRecords.findCourseResults(CHAT_ID, "3")).resolves.toMatchObject({ kind: "results", course: "Talin frisbeegolfrata" });
  });

  it("saves a player's result once per round, even when the round end runs again", async () => {
    await scoreRecords.saveResults([{ playerId: 2, strokes: 52, relativeToPar: -2 }], CHAT_ID, 1, 1);

    const [{ count }]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM scores WHERE competition_id = 1");
    expect(count).toBe(2);
  });
});
