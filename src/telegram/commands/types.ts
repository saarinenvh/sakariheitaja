import { CommandContext, Context } from "grammy";
import { ChatMessenger } from "../../features/chatMessenger";
import { MetrixClient } from "../../integrations/metrix/client";
import { OpenWeatherClient } from "../../integrations/openweather/client";
import { OllamaClient } from "../../integrations/ollama/client";
import { ChallongeClient } from "../../integrations/challonge/client";
import { GiphyClient } from "../../integrations/giphy/client";
import { RecipesClient } from "../../integrations/recipes/client";

/** Everything the commands reach: built once in main.ts. */
export interface CommandDependencies {
  messenger: ChatMessenger;
  metrix: MetrixClient;
  openWeather: OpenWeatherClient;
  ollama: OllamaClient;
  challonge: ChallongeClient;
  giphy: GiphyClient;
  recipes: RecipesClient;
  llmEnabled: boolean;
  /** The group whose game plans the morning greeting lists (`GAMES_CHAT_ID`). */
  gamesChatId: number | undefined;
}

export type CommandHandler = (ctx: CommandContext<Context>) => Promise<unknown>;

/** One line in /apua. */
export interface CommandHelp {
  usage: string;
  description: string;
}

/** A Telegram command: what it's called, how /apua explains it, and what handles it. */
export interface BotCommand {
  /** The command without its slash. */
  name: string;
  /** /apua lines; a command without help (dev commands, easter eggs) is left out of /apua. */
  help?: readonly CommandHelp[];
  handle: CommandHandler;
}

/** A feature's commands, under one heading in /apua. */
export interface CommandGroup {
  title: string;
  commands: readonly BotCommand[];
}
