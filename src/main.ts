import "reflect-metadata";
import { loadEnvironmentFile, readConfig, requireStartupConfig } from "./config";
loadEnvironmentFile();
const config = requireStartupConfig(readConfig());

import { moduleLogger } from "./shared/logger";
import { dataSource } from "./db/dataSource";
import { createBot } from "./telegram/bot";
import { createTelegramMessenger } from "./telegram/messenger";
import { registerCommands } from "./telegram/commands/registry";
import { CommandDependencies } from "./telegram/commands/types";
import { createMetrixClient } from "./integrations/metrix/client";
import { createOpenWeatherClient } from "./integrations/openweather/client";
import { createOllamaClient } from "./integrations/ollama/client";
import { createChallongeClient } from "./integrations/challonge/client";
import { createGiphyClient } from "./integrations/giphy/client";
import { createRecipesClient } from "./integrations/recipes/client";
import { resumeFollowedRounds } from "./features/live-scoring";
import { startMorningGreeter } from "./features/morning-greeting";

// The composition root: everything the bot talks to is created here, once, and passed down.

const log = moduleLogger("main");

const bot = createBot(config.telegram.token);
const dependencies: CommandDependencies = {
  messenger: createTelegramMessenger(bot.api),
  metrix: createMetrixClient(config.metrix),
  openWeather: createOpenWeatherClient({ apiKey: config.openWeatherMapApiKey }),
  ollama: createOllamaClient(config.ollama),
  challonge: createChallongeClient(config.challonge),
  giphy: createGiphyClient({ apiKey: config.giphyApiKey }),
  recipes: createRecipesClient(),
  llmEnabled: config.llmEnabled,
  gamesChatId: config.telegram.gamesChatId,
};

registerCommands(bot, dependencies);

bot.catch(botError => {
  log.warn({ err: botError.error, updateId: botError.ctx.update.update_id }, "bot error");
});

async function main(): Promise<void> {
  await dataSource.initialize();
  startMorningGreeter(dependencies, config.telegram.morningChatId);
  await resumeFollowedRounds(dependencies);
  bot.start();
}

main().catch(err => {
  log.fatal({ err }, "fatal startup error");
  process.exit(1);
});
