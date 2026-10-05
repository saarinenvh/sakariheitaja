import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Player } from "../../players";
import { Course } from "./Course.entity";

/**
 * A special score on one hole. The three kinds share this shape, with one table each.
 * `holeNumber` is null on rows saved before holes were.
 */
export abstract class SpecialScoreRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  /** `YYYY-MM-DD`. */
  @Column({ type: "date" })
  date!: string;

  @Column({ name: "player_id", type: "int" })
  playerId!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  @Column({ name: "course_id", type: "int" })
  courseId!: number;

  @Column({ name: "competition_id", type: "int" })
  competitionId!: number;

  @Column({ name: "hole_number", type: "smallint", unsigned: true, nullable: true })
  holeNumber!: number | null;

  @ManyToOne(() => Player, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @ManyToOne(() => Course, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "course_id" })
  course!: Course;
}

@Entity("aces")
@Index("uq_aces_player_hole", ["competitionId", "playerId", "holeNumber"], { unique: true })
export class Ace extends SpecialScoreRecord {}

@Entity("eagles")
@Index("uq_eagles_player_hole", ["competitionId", "playerId", "holeNumber"], { unique: true })
export class Eagle extends SpecialScoreRecord {}

@Entity("albatrosses")
@Index("uq_albatrosses_player_hole", ["competitionId", "playerId", "holeNumber"], { unique: true })
export class Albatross extends SpecialScoreRecord {}
