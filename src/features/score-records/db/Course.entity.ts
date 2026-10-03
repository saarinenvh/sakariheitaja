import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("courses")
export class Course {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
