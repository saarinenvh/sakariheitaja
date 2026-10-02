import { Entity, PrimaryColumn } from "typeorm";

@Entity("player_to_chat")
export class PlayerToChat {
  @PrimaryColumn({ name: "player_id" })
  playerId!: number;

  @PrimaryColumn({ name: "chat_id" })
  chatId!: number;
}
