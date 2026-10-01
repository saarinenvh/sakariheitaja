import "reflect-metadata";
import { loadEnvironmentFile, readConfig, requireStartupConfig } from "./config";
loadEnvironmentFile();
requireStartupConfig(readConfig());

import { moduleLogger } from "./shared/logger";
const log = moduleLogger("main");

import { dataSource } from "./db/dataSource";
import { bot } from "./bot/bot";
import { telegramMessenger } from "./bot/messenger";
import * as registry from "./state/competitionRegistry";
import { Orchestrator } from "./features/disc-golf/following/orchestrator";
import * as competitionService from "./features/disc-golf/services/CompetitionService";
import * as chatRepo from "./db/repositories/ChatRepository";
import { startMorningGreeter } from "./scheduler/morningGreeter";

import { competition } from "./bot/handlers/competition";
import { players } from "./bot/handlers/players";
import { scores } from "./bot/handlers/scores";
import { weather } from "./bot/handlers/weather";
import { recipe } from "./bot/handlers/recipe";
import { bagtag } from "./bot/handlers/bagtag";
import { fun } from "./bot/handlers/fun"; // must be last — catches all message:text

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

bot.catch(err => {
  log.warn({ err }, "bot error");
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  startMorningGreeter(bot);

  const unfinished = await competitionService.getUnfinished();
  for (const i of unfinished) {
    const orchestrator = await new Orchestrator(i.id, i.metrixId, i.chatId, telegramMessenger, true).init();
    registry.add(i.chatId, orchestrator);
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
