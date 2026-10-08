import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * Game plans (`/hep`) and their players. utf8mb4, unlike the older tables, so a plan's free text can
 * hold emoji. The collation ignores case but not accents: "wiltzu" is "Wiltzu", "Maki" isn't "Mäki".
 * A player with a Telegram id is unique by it; one without is unique by name, through a column that
 * holds the name only when there's no id.
 */
export class CreateGamePlans1791465872374 implements MigrationInterface {
  name = "CreateGamePlans1791465872374";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_plans (
        id INT NOT NULL AUTO_INCREMENT,
        chat_id BIGINT(20) NOT NULL,
        creator_telegram_id BIGINT(20) NOT NULL,
        creator_name VARCHAR(100) NOT NULL,
        day DATE NOT NULL,
        start_time TIME NULL,
        courses TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY chat_day (chat_id, day),
        CONSTRAINT fk_game_plans_chat_id FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_as_ci
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_plan_players (
        id INT NOT NULL AUTO_INCREMENT,
        plan_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        telegram_user_id BIGINT(20) NULL,
        name_without_id VARCHAR(100) AS (IF(telegram_user_id IS NULL, name, NULL)) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY plan_telegram_user (plan_id, telegram_user_id),
        UNIQUE KEY plan_name_without_id (plan_id, name_without_id),
        CONSTRAINT fk_game_plan_players_plan_id FOREIGN KEY (plan_id) REFERENCES game_plans (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_as_ci
    `);
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS game_plan_players");
    await queryRunner.query("DROP TABLE IF EXISTS game_plans");
  }
}
