import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "../features/players/db/Player.entity";
import { Chat } from "../features/chats/db/Chat.entity";
import { Competition } from "../features/live-scoring/db/Competition.entity";
import { Course } from "../features/score-records/db/Course.entity";
import { Ace, Albatross, Eagle } from "../features/score-records/db/SpecialScore.entity";
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
  // BIGINT (Telegram chat ids) as numbers on every path, entity or raw query; only a value beyond
  // 2^53, which no chat id is, would stay a string instead of being rounded.
  supportBigNumbers: true,
  bigNumberStrings: false,
  synchronize: false,
  // Pending migrations run inside initialize(), so the bot doesn't start against an older schema.
  migrationsRun: true,
  logging: database.logQueries,
  // The tables without an entity yet (player_to_chat, scores) are reached with SQL in their repositories.
  entities: [Player, Chat, Competition, Course, Ace, Eagle, Albatross],
  migrations: [AddSpecialScoreHoles1791188409491],
});
