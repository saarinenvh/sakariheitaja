import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("chats")
export class Chat {
  @PrimaryColumn({ type: "bigint" })
  id!: number;

  /** The group's title when the bot met it; nullable in the table. */
  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  /** The one message the bot keeps pinned here, or null. */
  @Column({ name: "bot_pinned_message_id", type: "int", nullable: true })
  botPinnedMessageId!: number | null;
}
