import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * The day a followed round is played, from Metrix. Rounds followed before this keep NULL: filling
 * them would mean one Metrix request per old competition.
 */
export class AddCompetitionDay1791269243562 implements MigrationInterface {
  name = "AddCompetitionDay1791269243562";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS day DATE NULL");
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE competitions DROP COLUMN IF EXISTS day");
  }
}
