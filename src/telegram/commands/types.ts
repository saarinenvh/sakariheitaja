import { CommandContext, Context } from "grammy";

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
