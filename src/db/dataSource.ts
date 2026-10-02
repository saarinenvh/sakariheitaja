import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "./entities/Player";
import { Chat } from "./entities/Chat";
import { Competition } from "./entities/Competition";
import { Course } from "./entities/Course";
import { PlayerToChat } from "./entities/PlayerToChat";
import { Score } from "./entities/Score";
import { Ace } from "./entities/Ace";
import { Eagle } from "./entities/Eagle";
import { Albatross } from "./entities/Albatross";
import { readConfig } from "../config";

const database = readConfig().database;

export const dataSource = new DataSource({
  type: "mysql",
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  synchronize: false,
  logging: database.logQueries,
  entities: [Player, Chat, Competition, Course, PlayerToChat, Score, Ace, Eagle, Albatross],
});
