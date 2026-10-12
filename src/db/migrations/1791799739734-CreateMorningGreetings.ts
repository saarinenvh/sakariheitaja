import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * The greetings Sakke wrote, so the next one can differ from the last few. utf8mb4 for emoji.
 * No foreign key to `chats`: the greeting chat needn't have a row there.
 */
export class CreateMorningGreetings1791799739734 implements MigrationInterface {
  name = "CreateMorningGreetings1791799739734";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS morning_greetings (
        id INT NOT NULL AUTO_INCREMENT,
        chat_id BIGINT(20) NOT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        text TEXT NOT NULL,
        PRIMARY KEY (id),
        KEY chat_sent_at (chat_id, sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_as_ci
    `);
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS morning_greetings");
  }
}
