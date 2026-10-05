import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Player } from "../../players";
import { Course } from "./Course.entity";

/** A player's final result in a followed round (`/tulokset`): strokes and relative to par. */
@Entity("scores")
export class Score {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "player_id", type: "int" })
  playerId!: number;

  @Column({ name: "chat_id", type: "bigint" })
  chatId!: number;

  @Column({ name: "course_id", type: "int" })
  courseId!: number;

  @Column({ name: "competition_id", type: "int" })
  competitionId!: number;

  /** Relative to par. */
  @Column({ type: "int" })
  diff!: number;

  /** Strokes. */
  @Column({ type: "int" })
  sum!: number;

  @ManyToOne(() => Player, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @ManyToOne(() => Course, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "course_id" })
  course!: Course;
}
