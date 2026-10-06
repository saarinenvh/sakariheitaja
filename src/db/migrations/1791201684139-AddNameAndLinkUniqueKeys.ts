import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

// Checked in prod before this was written (2026-10-05): none of these has duplicates today. A
// duplicate link added since is removed first: it is only the same player and chat again. A
// duplicate player or course name isn't, as results point at its id, so it makes the migration fail
// and the bot doesn't start until it is merged by hand.
const UNIQUE_KEYS = [
  { table: "player_to_chat", key: "uq_player_to_chat_player_chat", columns: "player_id, chat_id" },
  { table: "players", key: "uq_players_name", columns: "name" },
  { table: "courses", key: "uq_courses_name", columns: "name" },
] as const;

/**
 * One link per player and chat, and one player and one course per name. The collation is
 * case-insensitive, so "ville" and "Ville" count as the same name.
 */
export class AddNameAndLinkUniqueKeys1791201684139 implements MigrationInterface {
  name = "AddNameAndLinkUniqueKeys1791201684139";

  async up(queryRunner: SqlRunner): Promise<void> {
    // Keeps the oldest row of each player and chat; links are read and deleted by the pair, never the id.
    await queryRunner.query(`
      DELETE extra_link FROM player_to_chat AS extra_link
      INNER JOIN player_to_chat AS kept_link
        ON kept_link.player_id = extra_link.player_id AND kept_link.chat_id = extra_link.chat_id AND kept_link.id < extra_link.id
    `);

    for (const { table, key, columns } of UNIQUE_KEYS) {
      await queryRunner.query(`ALTER TABLE ${table} ADD UNIQUE KEY IF NOT EXISTS ${key} (${columns})`);
    }
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    for (const { table, key } of UNIQUE_KEYS) {
      await queryRunner.query(`ALTER TABLE ${table} DROP INDEX IF EXISTS ${key}`);
    }
  }
}
