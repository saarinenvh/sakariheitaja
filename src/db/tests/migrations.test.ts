import { describe, expect, it } from "vitest";
import { AddSpecialScoreHoles1791188409491, SqlRunner } from "../migrations/1791188409491-AddSpecialScoreHoles";

function recordingRunner(): { runner: SqlRunner; queries: string[] } {
  const queries: string[] = [];
  return { runner: { query: async (sql: string) => { queries.push(sql.replace(/\s+/g, " ").trim()); } }, queries };
}

describe("AddSpecialScoreHoles", () => {
  it("adds a re-runnable hole column and unique key to every special score table", async () => {
    const { runner, queries } = recordingRunner();
    await new AddSpecialScoreHoles1791188409491().up(runner);
    expect(queries).toEqual(["aces", "eagles", "albatrosses"].map(table =>
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS hole_number SMALLINT UNSIGNED NULL, `
      + `ADD UNIQUE KEY IF NOT EXISTS uq_${table}_player_hole (competition_id, player_id, hole_number)`));
  });

  it("removes both again on down", async () => {
    const { runner, queries } = recordingRunner();
    await new AddSpecialScoreHoles1791188409491().down(runner);
    expect(queries).toEqual(["aces", "eagles", "albatrosses"].map(table =>
      `ALTER TABLE ${table} DROP INDEX IF EXISTS uq_${table}_player_hole, DROP COLUMN IF EXISTS hole_number`));
  });
});
