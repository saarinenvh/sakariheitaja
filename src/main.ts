import "reflect-metadata";
import { loadEnvironmentFile, readConfig, requireStartupConfig } from "./config";
loadEnvironmentFile();
requireStartupConfig(readConfig());

import { moduleLogger } from "./shared/logger";
const log = moduleLogger("main");

import { dataSource } from "./db/dataSource";
import { bot } from "./telegram/bot";
import { trackerDependencies } from "./telegram/dependencies";
import * as registry from "./features/live-scoring/trackerRegistry";
import { ScoreTracker } from "./features/live-scoring/scoreTracker";
import * as competitionService from "./features/live-scoring/competitions";
import * as chatRepo from "./features/chats/chatRepository";
import { startMorningGreeter } from "./features/morning-greeting/morningGreeting";

import { competition } from "./telegram/commands/live-scoring/liveScoring";
import { players } from "./telegram/commands/players/players";
import { scores } from "./telegram/commands/score-records/scoreRecords";
import { weather } from "./telegram/commands/weather-report/weatherReport";
import { recipe } from "./telegram/commands/recipes/recipes";
import { bagtag } from "./telegram/commands/bagtags/bagtags";
import { fun } from "./telegram/commands/games/games"; // must be last — catches all message:text

bot.use(competition);
bot.use(players);
bot.use(scores);
bot.use(weather);
bot.use(recipe);
bot.use(bagtag);
bot.use(fun);

// ── New chat handling ─────────────────────────────────────────────────────────

bot.on("message:new_chat_members", ctx => {
  chatRepo.addIfAbsent(ctx.chat.id, ctx.chat.title ?? "")
    .catch(error => log.error({ err: error, chatId: ctx.chat.id }, "could not register chat"));
});

bot.on("message:group_chat_created", ctx => {
  chatRepo.addIfAbsent(ctx.chat.id, ctx.chat.title ?? "")
    .catch(error => log.error({ err: error, chatId: ctx.chat.id }, "could not register chat"));
});

// ── Error handling ────────────────────────────────────────────────────────────

bot.catch(botError => {
  log.warn({ err: botError.error, updateId: botError.ctx.update.update_id }, "bot error");
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  startMorningGreeter(bot);

  const unfinished = await competitionService.getUnfinished();
  for (const i of unfinished) {
    const tracker = await new ScoreTracker(i.id, i.metrixId, i.chatId, trackerDependencies, true).init();
    registry.add(i.chatId, tracker);
  }
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await init();
  bot.start();
}

main().catch(err => {
  log.fatal({ err }, "fatal startup error");
  process.exit(1);
});
