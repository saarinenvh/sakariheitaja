import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity("players")
@Index("uq_players_name", ["name"], { unique: true })
export class Player {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
