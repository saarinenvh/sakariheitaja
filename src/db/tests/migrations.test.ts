import { describe, expect, it } from "vitest";
import { AddSpecialScoreHoles1791188409491, SqlRunner } from "../migrations/1791188409491-AddSpecialScoreHoles";
import { AddNameAndLinkUniqueKeys1791201684139 } from "../migrations/1791201684139-AddNameAndLinkUniqueKeys";
import { AddCompetitionDay1791269243562 } from "../migrations/1791269243562-AddCompetitionDay";
import { AddChatBotPinnedMessage1791525001570 } from "../migrations/1791525001570-AddChatBotPinnedMessage";
import { AddCompetitionStoppedStatus1791553609581 } from "../migrations/1791553609581-AddCompetitionStoppedStatus";

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

describe("AddChatBotPinnedMessage", () => {
  it("adds a nullable, re-runnable pinned message column to chats, and removes it on down", async () => {
    const { runner, queries } = recordingRunner();
    await new AddChatBotPinnedMessage1791525001570().up(runner);
    await new AddChatBotPinnedMessage1791525001570().down(runner);

    expect(queries).toEqual([
      "ALTER TABLE chats ADD COLUMN IF NOT EXISTS bot_pinned_message_id INT NULL",
      "ALTER TABLE chats DROP COLUMN IF EXISTS bot_pinned_message_id",
    ]);
  });
});

describe("AddCompetitionStoppedStatus", () => {
  it("adds stopped to the status, keeping every existing value", async () => {
    const { runner, queries } = recordingRunner();
    await new AddCompetitionStoppedStatus1791553609581().up(runner);
    expect(queries).toEqual([
      "ALTER TABLE competitions MODIFY status ENUM('following', 'finished', 'error', 'stopped') NOT NULL DEFAULT 'following'",
    ]);
  });

  it("turns stopped rounds into finished ones before removing the value on down", async () => {
    const { runner, queries } = recordingRunner();
    await new AddCompetitionStoppedStatus1791553609581().down(runner);
    expect(queries).toEqual([
      "UPDATE competitions SET status = 'finished' WHERE status = 'stopped'",
      "ALTER TABLE competitions MODIFY status ENUM('following', 'finished', 'error') NOT NULL DEFAULT 'following'",
    ]);
  });
});
