import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { GamePlan } from "./GamePlan.entity";

/**
 * A player in a plan: a free name, with the Telegram id when it's known. Unique per plan by the id,
 * or by the name when there's no id (the table's generated `name_without_id`, not mapped here).
 */
@Entity("game_plan_players")
export class GamePlanPlayer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "plan_id", type: "int" })
  planId!: number;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ name: "telegram_user_id", type: "bigint", nullable: true })
  telegramUserId!: number | null;

  @ManyToOne(() => GamePlan, plan => plan.players, { onDelete: "CASCADE", createForeignKeyConstraints: false })
  @JoinColumn({ name: "plan_id" })
  plan!: GamePlan;
}
