import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "../features/players/db/Player.entity";
import { Chat } from "../features/chats/db/Chat.entity";
import { Competition } from "../features/live-scoring/db/Competition.entity";
import { Course } from "../features/score-records/db/Course.entity";
import { readConfig } from "../config";
import { AddSpecialScoreHoles1791188409491 } from "./migrations/1791188409491-AddSpecialScoreHoles";

const database = readConfig().database;

export const dataSource = new DataSource({
  type: "mysql",
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  synchronize: false,
  // Pending migrations run inside initialize(), so the bot doesn't start against an older schema.
  migrationsRun: true,
  logging: database.logQueries,
  // Only the tables read through TypeORM; the rest (player_to_chat, scores, aces, eagles, albatrosses) use SQL.
  entities: [Player, Chat, Competition, Course],
  migrations: [AddSpecialScoreHoles1791188409491],
});
