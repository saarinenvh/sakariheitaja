import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("scores")
export class Score {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "player_id" })
  playerId!: number;

  @Column({ name: "chat_id" })
  chatId!: number;

  @Column({ name: "course_id" })
  courseId!: number;

  @Column({ name: "competition_id" })
  competitionId!: number;

  @Column()
  diff!: number;

  @Column()
  sum!: number;
}
