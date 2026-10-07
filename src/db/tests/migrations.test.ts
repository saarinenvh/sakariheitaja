import { describe, expect, it } from "vitest";
import { AddSpecialScoreHoles1791188409491, SqlRunner } from "../migrations/1791188409491-AddSpecialScoreHoles";
import { AddNameAndLinkUniqueKeys1791201684139 } from "../migrations/1791201684139-AddNameAndLinkUniqueKeys";
import { AddCompetitionDay1791269243562 } from "../migrations/1791269243562-AddCompetitionDay";

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

describe("AddNameAndLinkUniqueKeys", () => {
  it("removes duplicate links, then adds a re-runnable unique key per player link, player name and course name", async () => {
    const { runner, queries } = recordingRunner();
    await new AddNameAndLinkUniqueKeys1791201684139().up(runner);
    expect(queries).toEqual([
      "DELETE extra_link FROM player_to_chat AS extra_link INNER JOIN player_to_chat AS kept_link ON kept_link.player_id = extra_link.player_id AND kept_link.chat_id = extra_link.chat_id AND kept_link.id < extra_link.id",
      "ALTER TABLE player_to_chat ADD UNIQUE KEY IF NOT EXISTS uq_player_to_chat_player_chat (player_id, chat_id)",
      "ALTER TABLE players ADD UNIQUE KEY IF NOT EXISTS uq_players_name (name)",
      "ALTER TABLE courses ADD UNIQUE KEY IF NOT EXISTS uq_courses_name (name)",
    ]);
  });

  it("removes them again on down", async () => {
    const { runner, queries } = recordingRunner();
    await new AddNameAndLinkUniqueKeys1791201684139().down(runner);
    expect(queries).toEqual([
      "ALTER TABLE player_to_chat DROP INDEX IF EXISTS uq_player_to_chat_player_chat",
      "ALTER TABLE players DROP INDEX IF EXISTS uq_players_name",
      "ALTER TABLE courses DROP INDEX IF EXISTS uq_courses_name",
    ]);
  });
});

describe("AddCompetitionDay", () => {
  it("adds a nullable, re-runnable day column, and removes it on down", async () => {
    const { runner, queries } = recordingRunner();
    await new AddCompetitionDay1791269243562().up(runner);
    await new AddCompetitionDay1791269243562().down(runner);

    expect(queries).toEqual([
      "ALTER TABLE competitions ADD COLUMN IF NOT EXISTS day DATE NULL",
      "ALTER TABLE competitions DROP COLUMN IF EXISTS day",
    ]);
  });
});
