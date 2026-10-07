import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/** A followed round. The columns are nullable in the table; the repository only returns usable rows. */
@Entity("competitions")
export class Competition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "chat_id", type: "bigint", nullable: true })
  chatId!: number | null;

  @Column({ name: "metrix_id", type: "varchar", length: 100, nullable: true })
  metrixId!: string | null;

  @Column({ type: "boolean", nullable: true })
  finished!: boolean | null;

  /** The round's day (`YYYY-MM-DD`), from Metrix; null on rounds followed before it was saved. */
  @Column({ type: "date", nullable: true })
  day!: string | null;
}
