import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity("courses")
@Index("uq_courses_name", ["name"], { unique: true })
export class Course {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
