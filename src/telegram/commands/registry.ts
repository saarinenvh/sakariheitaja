import { Bot } from "grammy";
import { BotCommand, CommandDependencies, CommandGroup } from "./types";
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

/** Every command group, in /apua order; the dev group only with the LLM enabled. */
export function buildCommandGroups(deps: CommandDependencies): CommandGroup[] {
  const groups = [
    liveScoringCommands(deps), playerCommands, scoreRecordCommands, bagtagCommands,
    weatherCommands(deps), recipeCommands(deps), gameCommands, gifCommands(deps),
  ];
  const helpCommand: BotCommand = { name: "apua", handle: ctx => ctx.reply(formatHelp(groups)) };
  return [...groups, { title: "Apua:", commands: [helpCommand] }, ...(deps.llmEnabled ? [devCommands(deps)] : [])];
}

/**
 * Registers every command, then the chat tracking, then the text listener. The listener reacts to any
 * text, so it has to come last; registering it here, after everything else, keeps that true.
 */
export function registerCommands(bot: Pick<Bot, "command" | "on">, deps: CommandDependencies): void {
  for (const group of buildCommandGroups(deps)) {
    for (const command of group.commands) bot.command(command.name, ctx => runCommand(command, ctx));
  }
  registerChatTracking(bot);
  bot.on("message:text", ctx => reactToMessage(ctx, deps));
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
