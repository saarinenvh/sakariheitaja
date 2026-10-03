import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("players")
export class Player {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
