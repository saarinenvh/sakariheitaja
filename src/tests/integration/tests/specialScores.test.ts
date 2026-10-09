import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const CHAT_ID = -5238320046;
const PLAYED = { courseName: "Kaatis", day: "2026-10-03" };
const NOW = new Date(2026, 9, 5, 12, 0);
const strokes = (holeNumber: number, count: number, relativeToPar: number) =>
  ({ holeNumber, score: { strokes: count, relativeToPar, obCount: 0 } });

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let scoreRecords: typeof import("../../../features/score-records");
let round: { playerId: number; chatId: number; competitionId: number };

beforeAll(async () => {
  dataSource = await startBotDatabase("special_scores");
  scoreRecords = await import("../../../features/score-records");

  await dataSource.query("INSERT INTO chats (id, name) VALUES (?, 'Testi')", [CHAT_ID]);
  await dataSource.query("INSERT INTO players (name) VALUES ('Ville')");
  await dataSource.query("INSERT INTO courses (name) VALUES ('Kaatis')");
  await dataSource.query("INSERT INTO competitions (chat_id, metrix_id) VALUES (?, '3809486')", [CHAT_ID]);
  round = { playerId: 1, chatId: CHAT_ID, competitionId: 1 };
});

afterAll(async () => {
  await dataSource?.destroy();
});

async function aceRows(): Promise<{ hole: number; date: string }[]> {
  return dataSource.query("SELECT hole_number AS hole, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM aces ORDER BY hole_number");
}

describe("courses", () => {
  it("finds a stored course whatever the case of the name, without adding another", async () => {
    const course = await scoreRecords.getOrCreateCourse("KAATIS");
    const [{ count }]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM courses");

    expect(course?.name).toBe("Kaatis");
    expect(count).toBe(1);
  });
});

describe("special scores", () => {
  it("adds an ace once, dated with the round's day", async () => {
    const update = { kind: "add" as const, holes: [strokes(6, 1, -2)] };

    await scoreRecords.updateSpecialScores(round, PLAYED, update, NOW);
    await scoreRecords.updateSpecialScores(round, PLAYED, update, NOW);

    expect(await aceRows()).toEqual([{ hole: 6, date: "2026-10-03" }]);
  });

  it("rebuilds from the card, so a corrected ace goes and a new one is saved", async () => {
    await scoreRecords.updateSpecialScores(round, PLAYED, { kind: "rebuild", holes: [strokes(6, 2, -1), strokes(7, 1, -2)] }, NOW);

    expect(await aceRows()).toEqual([{ hole: 7, date: "2026-10-03" }]);
  });

  it("are listed by /assat with the player, course and hole", async () => {
    const report = await scoreRecords.buildSpecialScoreReport({
      kind: "ace", chatId: CHAT_ID, period: { kind: "year", year: 2026 }, query: null,
    });

    expect(report).toMatchObject({
      kind: "report",
      leaderboard: [{ player: "Ville", count: 1 }],
      latest: [{ player: "Ville", course: "Kaatis", holeNumber: 7, date: "2026-10-03" }],
    });
  });
});
