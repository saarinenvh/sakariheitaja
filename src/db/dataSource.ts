import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "../features/players/db/Player.entity";
import { PlayerChat } from "../features/players/db/PlayerChat.entity";
import { Chat } from "../features/chats/db/Chat.entity";
import { Competition } from "../features/live-scoring/db/Competition.entity";
import { Course } from "../features/score-records/db/Course.entity";
import { Ace, Albatross, Eagle } from "../features/score-records/db/SpecialScore.entity";
import { Score } from "../features/score-records/db/Score.entity";
import { GamePlan } from "../features/games/db/GamePlan.entity";
import { GamePlanPlayer } from "../features/games/db/GamePlanPlayer.entity";
import { readConfig } from "../config";
import { AddSpecialScoreHoles1791188409491 } from "./migrations/1791188409491-AddSpecialScoreHoles";
import { AddNameAndLinkUniqueKeys1791201684139 } from "./migrations/1791201684139-AddNameAndLinkUniqueKeys";
import { AddCompetitionDay1791269243562 } from "./migrations/1791269243562-AddCompetitionDay";
import { ReplaceCompetitionFinishedWithStatus1791362797286 } from "./migrations/1791362797286-ReplaceCompetitionFinishedWithStatus";
import { MakeCompetitionChatAndMetrixRequired1791378525211 } from "./migrations/1791378525211-MakeCompetitionChatAndMetrixRequired";
import { CreateGamePlans1791465872374 } from "./migrations/1791465872374-CreateGamePlans";

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
  entities: [Player, PlayerChat, Chat, Competition, Course, Score, Ace, Eagle, Albatross, GamePlan, GamePlanPlayer],
  migrations: [
    AddSpecialScoreHoles1791188409491, AddNameAndLinkUniqueKeys1791201684139, AddCompetitionDay1791269243562,
    ReplaceCompetitionFinishedWithStatus1791362797286, MakeCompetitionChatAndMetrixRequired1791378525211,
    CreateGamePlans1791465872374,
  ],
});
