import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("chats")
export class Chat {
  @PrimaryColumn({ type: "bigint" })
  id!: number;

  @Column()
  name!: string;
}
