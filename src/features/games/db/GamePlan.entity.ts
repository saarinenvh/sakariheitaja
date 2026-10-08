import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { GamePlanPlayer } from "./GamePlanPlayer.entity";

/** A planned game (`/hep`), in the chat it was made in. */
@Entity("game_plans")
export class GamePlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  /** Who made the plan; not necessarily one of its players. */
  @Column({ name: "creator_telegram_id", type: "bigint" })
  creatorTelegramId!: number;

  @Column({ name: "creator_name", type: "varchar", length: 100 })
  creatorName!: string;

  /** `YYYY-MM-DD`, Helsinki time. */
  @Column({ type: "date" })
  day!: string;

  /** `HH:MM:SS`, or null when the plan has no time. */
  @Column({ name: "start_time", type: "time", nullable: true })
  startTime!: string | null;

  /** Free course names, in the order they're played. */
  @Column({ type: "simple-json" })
  courses!: string[];

  /** The plan as it was written. */
  @Column({ type: "text" })
  text!: string;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @OneToMany(() => GamePlanPlayer, player => player.plan)
  players!: GamePlanPlayer[];
}
