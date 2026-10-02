import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("aces")
export class Ace {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "date" })
  date!: string;

  @Column({ name: "player_id" })
  playerId!: number;

  @Column({ name: "chat_id" })
  chatId!: number;

  @Column({ name: "course_id" })
  courseId!: number;

  @Column({ name: "competition_id" })
  competitionId!: number;
}
