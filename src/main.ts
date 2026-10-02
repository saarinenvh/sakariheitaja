import "reflect-metadata";
import { loadEnvironmentFile, readConfig, requireStartupConfig } from "./config";
loadEnvironmentFile();
requireStartupConfig(readConfig());

import { moduleLogger } from "./shared/logger";
const log = moduleLogger("main");

import { dataSource } from "./db/dataSource";
import { bot } from "./telegram/bot";
import { morningGreetingDependencies, trackerDependencies } from "./telegram/dependencies";
import * as registry from "./features/live-scoring/trackerRegistry";
import { ScoreTracker } from "./features/live-scoring/scoreTracker";
import * as competitionService from "./features/live-scoring/competitions";
import { startMorningGreeter } from "./features/morning-greeting/morningGreeting";

import { registerCommands } from "./telegram/commands/registry";

registerCommands(bot, readConfig().llmEnabled);

// ── Error handling ────────────────────────────────────────────────────────────

bot.catch(botError => {
  log.warn({ err: botError.error, updateId: botError.ctx.update.update_id }, "bot error");
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  startMorningGreeter(morningGreetingDependencies, readConfig().telegram.morningChatId);

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
