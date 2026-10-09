import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/**
 * Where a followed round is: being followed (also while it waits to start), finished, given up on, or
 * stopped with `/lopeta`. Only `following` is resumed.
 */
export const COMPETITION_STATUS = {
  following: "following",
  finished: "finished",
  error: "error",
  stopped: "stopped",
} as const;

export type CompetitionStatus = typeof COMPETITION_STATUS[keyof typeof COMPETITION_STATUS];

/** A followed round. */
@Entity("competitions")
export class Competition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  @Column({ name: "metrix_id", type: "varchar", length: 100 })
  metrixId!: string;

  @Column({ type: "enum", enum: Object.values(COMPETITION_STATUS) })
  status!: CompetitionStatus;

  /** The round's day (`YYYY-MM-DD`), from Metrix; null on rounds followed before it was saved. */
  @Column({ type: "date", nullable: true })
  day!: string | null;

  /** When the round was given up on; set with `errorReason` once its status is `error`. */
  @Column({ name: "errored_at", type: "datetime", nullable: true })
  erroredAt!: Date | null;

  @Column({ name: "error_reason", type: "varchar", length: 255, nullable: true })
  errorReason!: string | null;
}
