import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Chat } from "../../chats";
import { Player } from "./Player.entity";

/** A player a chat follows (`/lisaa`). The table has its own id, so it's an entity, not a plain join table. */
@Entity("player_to_chat")
@Index("uq_player_to_chat_player_chat", ["playerId", "chatId"], { unique: true })
export class PlayerChat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "player_id", type: "int" })
  playerId!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  @ManyToOne(() => Player, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @ManyToOne(() => Chat, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "chat_id" })
  chat!: Chat;
}
