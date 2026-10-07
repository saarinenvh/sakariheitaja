import { CommandContext, Context } from "grammy";
import { llmHeckle } from "../../../features/heckler";
import { MorningGreetingDependencies, sendMorningGreeting } from "../../../features/morning-greeting";
import { competitionRepository as competitionRepo, ErroredRound } from "../../../features/live-scoring";
import { OllamaClient } from "../../../integrations/ollama/client";
import { devMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

const DISPLAY_TIME_ZONE = "Europe/Helsinki";

/** An LLM heckle on demand, from the chat's recent messages; the argument overrides the trigger. */
export async function forceHeckle(ctx: Command, ollama: OllamaClient): Promise<unknown> {
  const trigger = ctx.match?.trim() || ctx.message?.text || "Sakke";
  return ctx.reply(await llmHeckle(ollama, ctx.chat.id, trigger));
}

export async function sendMorningGreetingNow(ctx: Command, deps: MorningGreetingDependencies): Promise<void> {
  await sendMorningGreeting(deps, ctx.chat.id);
}

/** The rounds in every chat that were given up on. */
export async function listErroredRounds(ctx: Command): Promise<unknown> {
  return ctx.reply(formatErroredRounds(await competitionRepo.findErrored()));
}

/** `/virheet`: the rounds given up on, one per line, for handling them by hand. */
export function formatErroredRounds(rounds: readonly ErroredRound[]): string {
  if (rounds.length === 0) return MSG.virheetNone;

  const lines = rounds.map(round =>
    `${round.metrixId} (kilpailu ${round.id}, chat ${round.chatId}) ${formatErrorTime(round.erroredAt)}: ${round.errorReason ?? "?"}`);
  return MSG.virheetHeader + lines.join("\n");
}

function formatErrorTime(time: Date | null): string {
  return time ? time.toLocaleString("fi-FI", { timeZone: DISPLAY_TIME_ZONE }) : "?";
}
