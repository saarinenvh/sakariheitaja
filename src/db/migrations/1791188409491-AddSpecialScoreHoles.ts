import type { MigrationInterface } from "typeorm";

const SPECIAL_SCORE_TABLES = ["aces", "eagles", "albatrosses"] as const;

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * Gives each special score its hole, so a corrected score can be replaced or removed and saving a
 * hole again is a no-op. Rows saved before this keep a NULL hole, which the unique key allows to repeat.
 * IF NOT EXISTS lets a run that failed halfway be repeated, since MariaDB can't roll back DDL.
 */
export class AddSpecialScoreHoles1791188409491 implements MigrationInterface {
  name = "AddSpecialScoreHoles1791188409491";

  async up(queryRunner: SqlRunner): Promise<void> {
    for (const table of SPECIAL_SCORE_TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS hole_number SMALLINT UNSIGNED NULL,
          ADD UNIQUE KEY IF NOT EXISTS uq_${table}_player_hole (competition_id, player_id, hole_number)
      `);
    }
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    for (const table of SPECIAL_SCORE_TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP INDEX IF EXISTS uq_${table}_player_hole,
          DROP COLUMN IF EXISTS hole_number
      `);
    }
  }
}
