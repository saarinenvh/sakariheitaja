import { Bot } from "grammy";
import { BotCommand, CommandGroup } from "./types";
import { liveScoringCommands } from "./live-scoring/command";
import { playerCommands } from "./players/command";
import { scoreRecordCommands } from "./score-records/command";
import { bagtagCommands } from "./bagtags/command";
import { weatherCommands } from "./weather-report/command";
import { recipeCommands } from "./recipes/command";
import { gameCommands } from "./games/command";
import { gifCommands } from "./gifs/command";
import { devCommands } from "./dev/command";
import { formatHelp } from "./help/help";
import { reactToMessage } from "./chatter/chatter";
import { registerChatTracking } from "../chatRegistration";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("commands");

/** Every command, in /apua order. The dev group is registered only when the LLM is enabled. */
const COMMAND_GROUPS: readonly CommandGroup[] = [
  liveScoringCommands, playerCommands, scoreRecordCommands, bagtagCommands,
  weatherCommands, recipeCommands, gameCommands, gifCommands,
];

const helpCommand: BotCommand = { name: "apua", handle: ctx => ctx.reply(formatHelp(COMMAND_GROUPS)) };

/** The commands to register; exported so tests and /apua see the same list. */
export function activeCommandGroups(llmEnabled: boolean): CommandGroup[] {
  const helpGroup: CommandGroup = { title: "Apua:", commands: [helpCommand] };
  return [...COMMAND_GROUPS, helpGroup, ...(llmEnabled ? [devCommands] : [])];
}

/**
 * Registers every command, then the chat tracking, then the text listener. The listener reacts to any
 * text, so it has to come last; registering it here, after everything else, keeps that true.
 */
export function registerCommands(bot: Pick<Bot, "command" | "on">, llmEnabled: boolean): void {
  for (const group of activeCommandGroups(llmEnabled)) {
    for (const command of group.commands) bot.command(command.name, ctx => runCommand(command, ctx));
  }
  registerChatTracking(bot);
  bot.on("message:text", reactToMessage);
}

/** The one place a command is logged and its failure caught. */
async function runCommand(command: BotCommand, ctx: Parameters<BotCommand["handle"]>[0]): Promise<void> {
  log.info({ command: command.name, chatId: ctx.chat.id }, "command");
  try {
    await command.handle(ctx);
  } catch (err) {
    log.error({ command: command.name, chatId: ctx.chat.id, err }, "command failed");
  }
}
