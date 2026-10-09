import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";
import type { HoleScore, Scorecard } from "../../../integrations/metrix/round/types";

const CHAT_ID = -5238320046;
const PLAYED = { courseName: "Kaatis", day: "2026-10-03" };
const NOW = new Date(2026, 9, 5, 12, 0);
const par: HoleScore = { strokes: 3, relativeToPar: 0, obCount: 0 };
const ace: HoleScore = { strokes: 1, relativeToPar: -2, obCount: 0 };
const eagle: HoleScore = { strokes: 3, relativeToPar: -2, obCount: 0 };
const card = (...holes: HoleScore[]): Scorecard => ({ kind: "available", holes });

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

async function aceIds(): Promise<{ id: number }[]> {
  return dataSource.query("SELECT id FROM aces ORDER BY hole_number");
}

function sync(scorecard: Scorecard): Promise<void> {
  return scoreRecords.syncSpecialScores(round, PLAYED, scorecard, NOW);
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
  it("saves the card's ace once, dated with the round's day, however often it's synced", async () => {
    await sync(card(par, ace));
    const [{ id }] = await aceIds();
    await sync(card(par, ace));

    expect(await aceRows()).toEqual([{ hole: 2, date: "2026-10-03" }]);
    expect(await aceIds()).toEqual([{ id }]);
  });

  it("drops a corrected ace and adds a new one, keeping the row that stays", async () => {
    await sync(card(ace, ace));
    const [{ id: holeOneId }] = await aceIds();

    await sync(card(ace, par, ace));

    expect(await aceRows()).toEqual([{ hole: 1, date: "2026-10-03" }, { hole: 3, date: "2026-10-03" }]);
    expect((await aceIds())[0].id).toBe(holeOneId);
  });

  it("removes this round's row saved before holes were recorded, never another round's", async () => {
    await dataSource.query("INSERT INTO competitions (chat_id, metrix_id) VALUES (?, '1000')", [CHAT_ID]);
    await dataSource.query(
      `INSERT INTO aces (date, player_id, chat_id, course_id, competition_id, hole_number)
       VALUES ('2026-10-03', 1, ?, 1, 1, NULL), ('2024-06-01', 1, ?, 1, 2, NULL)`,
      [CHAT_ID, CHAT_ID],
    );

    await sync(card(ace, par, ace));

    expect(await aceRows()).toEqual([
      { hole: null, date: "2024-06-01" }, { hole: 1, date: "2026-10-03" }, { hole: 3, date: "2026-10-03" },
    ]);
    await dataSource.query("DELETE FROM aces WHERE competition_id = 2");
  });

  it("removes them all when the card has none left, and saves an eagle in its own table", async () => {
    await sync(card(par, par, eagle));

    expect(await aceRows()).toEqual([]);
    const [{ count }]: { count: number }[] = await dataSource.query("SELECT COUNT(*) AS count FROM eagles");
    expect(count).toBe(1);
  });

  it("are listed by /assat with the player, course and hole", async () => {
    await sync(card(par, par, par, par, par, par, ace));

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
