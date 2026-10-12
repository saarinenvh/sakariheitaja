import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/** A greeting Sakke wrote and sent; the canned one isn't kept. */
@Entity("morning_greetings")
export class MorningGreeting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  @Column({ name: "sent_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  sentAt!: Date;

  @Column({ type: "text" })
  text!: string;
}
