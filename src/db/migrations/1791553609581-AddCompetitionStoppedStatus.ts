import type { MigrationInterface } from "typeorm";
import type { SqlRunner } from "./1791362797286-ReplaceCompetitionFinishedWithStatus";

/**
 * A round stopped with `/lopeta` is `stopped`, where it used to be deleted with its special scores.
 * Existing rows keep their status: the enum only gains a value.
 */
export class AddCompetitionStoppedStatus1791553609581 implements MigrationInterface {
  name = "AddCompetitionStoppedStatus1791553609581";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE competitions
        MODIFY status ENUM('following', 'finished', 'error', 'stopped') NOT NULL DEFAULT 'following'
    `);
  }

  /** A stopped round becomes finished, which nothing resumes either, so its row and scores stay. */
  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("UPDATE competitions SET status = 'finished' WHERE status = 'stopped'");
    await queryRunner.query(`
      ALTER TABLE competitions
        MODIFY status ENUM('following', 'finished', 'error') NOT NULL DEFAULT 'following'
    `);
  }
}
