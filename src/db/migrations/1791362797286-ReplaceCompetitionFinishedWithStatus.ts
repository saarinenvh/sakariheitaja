import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * A followed round's state as one column: `following`, `finished` or `error`. `finished = 0` becomes
 * `following`; 1 and NULL become `finished`, since neither was resumed before. A round in `error`
 * keeps when it failed and why, for manual handling.
 */
export class ReplaceCompetitionFinishedWithStatus1791362797286 implements MigrationInterface {
  name = "ReplaceCompetitionFinishedWithStatus1791362797286";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE competitions
        ADD COLUMN IF NOT EXISTS status ENUM('following', 'finished', 'error') NOT NULL DEFAULT 'following',
        ADD COLUMN IF NOT EXISTS errored_at DATETIME NULL,
        ADD COLUMN IF NOT EXISTS error_reason VARCHAR(255) NULL
    `);
    await queryRunner.query("UPDATE competitions SET status = IF(finished = 0, 'following', 'finished')");
    await queryRunner.query("ALTER TABLE competitions DROP COLUMN IF EXISTS finished");
  }

  /** An `error` round goes back to finished: before this, nothing would resume it either. */
  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS finished TINYINT(1) NULL");
    await queryRunner.query("UPDATE competitions SET finished = IF(status = 'following', 0, 1)");
    await queryRunner.query(`
      ALTER TABLE competitions
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS errored_at,
        DROP COLUMN IF EXISTS error_reason
    `);
  }
}
