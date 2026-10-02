import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "../features/players/Player.entity";
import { Chat } from "../features/chats/Chat.entity";
import { Competition } from "../features/live-scoring/Competition.entity";
import { Course } from "../features/score-records/Course.entity";
import { PlayerToChat } from "../features/players/PlayerToChat.entity";
import { Score } from "../features/score-records/Score.entity";
import { Ace } from "../features/score-records/Ace.entity";
import { Eagle } from "../features/score-records/Eagle.entity";
import { Albatross } from "../features/score-records/Albatross.entity";
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
