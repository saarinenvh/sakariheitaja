import type { MigrationInterface } from "typeorm";

/** The part of TypeORM's QueryRunner this migration uses. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * The one message the bot keeps pinned in a chat, so it edits or unpins its own pin and never
 * someone else's. Telegram itself only reports the latest pin.
 */
export class AddChatBotPinnedMessage1791525001570 implements MigrationInterface {
  name = "AddChatBotPinnedMessage1791525001570";

  async up(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE chats ADD COLUMN IF NOT EXISTS bot_pinned_message_id INT NULL");
  }

  async down(queryRunner: SqlRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE chats DROP COLUMN IF EXISTS bot_pinned_message_id");
  }
}
