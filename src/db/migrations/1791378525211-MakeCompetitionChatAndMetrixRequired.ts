import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * Every competition has a chat and a Metrix id. Old rows without them could never be followed or
 * shown; prod had five, none with results or special scores, so deleting them loses nothing.
 */
export class MakeCompetitionChatAndMetrixRequired1791378525211 implements MigrationInterface {
  name = "MakeCompetitionChatAndMetrixRequired1791378525211";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("DELETE FROM competitions WHERE chat_id IS NULL OR metrix_id IS NULL");
    await queryRunner.query(`
      ALTER TABLE competitions
        MODIFY chat_id BIGINT(20) NOT NULL,
        MODIFY metrix_id VARCHAR(100) NOT NULL
    `);
  }

  /** The deleted rows don't come back. */
  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE competitions
        MODIFY chat_id BIGINT(20) NULL,
        MODIFY metrix_id VARCHAR(100) NULL
    `);
  }
}
