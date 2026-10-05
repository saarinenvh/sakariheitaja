import { beforeEach, describe, expect, it, vi } from "vitest";

const queries: { sql: string; parameters: unknown[]; inTransaction: boolean }[] = [];

function recorder(inTransaction: boolean) {
  return {
    query: async (sql: string, parameters: unknown[]) => {
      queries.push({ sql: sql.replace(/\s+/g, " ").trim(), parameters, inTransaction });
      return { affectedRows: 0 };
    },
  };
}

// Records each query, inside or outside the transaction, so this checks the SQL without a database.
vi.mock("../../../../db/dataSource", () => ({
  dataSource: {
    ...recorder(false),
    transaction: async (work: (manager: unknown) => Promise<void>) => work(recorder(true)),
  },
}));

import { addSpecialScores, rebuildSpecialScores } from "../scoreRepository";

const round = { playerId: 42, chatId: -100, competitionId: 55 };
const insertAce = "INSERT IGNORE INTO aces (date, player_id, chat_id, course_id, competition_id, hole_number) VALUES (?, ?, ?, ?, ?, ?)";

beforeEach(() => {
  queries.length = 0;
});

describe("addSpecialScores", () => {
  it("inserts each score once per hole, without deleting anything", async () => {
    await addSpecialScores(round, { courseId: 7, date: "2026-10-05", scores: [{ holeNumber: 6, kind: "ace" }] });
    expect(queries).toEqual([{ sql: insertAce, parameters: ["2026-10-05", 42, -100, 7, 55, 6], inTransaction: false }]);
  });
});

describe("rebuildSpecialScores", () => {
  it("deletes the player's special scores in the round, then inserts the card's, in one transaction", async () => {
    await rebuildSpecialScores(round, { courseId: 7, date: "2026-10-05", scores: [{ holeNumber: 6, kind: "ace" }] });
    expect(queries).toEqual([
      ...["aces", "eagles", "albatrosses"].map(table => ({
        sql: `DELETE FROM ${table} WHERE competition_id = ? AND player_id = ?`, parameters: [55, 42], inTransaction: true,
      })),
      { sql: insertAce, parameters: ["2026-10-05", 42, -100, 7, 55, 6], inTransaction: true },
    ]);
  });

  it("only deletes when the card has no special scores left", async () => {
    await rebuildSpecialScores(round, null);
    expect(queries.map(query => query.sql.split(" WHERE")[0])).toEqual(["DELETE FROM aces", "DELETE FROM eagles", "DELETE FROM albatrosses"]);
  });
});
