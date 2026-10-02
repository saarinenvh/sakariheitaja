import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("competitions")
export class Competition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "chat_id" })
  chatId!: number;

  @Column({ name: "metrix_id" })
  metrixId!: string;

  @Column()
  finished!: boolean;
}
