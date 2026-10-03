import { CommandContext, Context } from "grammy";
import { llmHeckle } from "../../../features/heckler";
import { MorningGreetingDependencies, sendMorningGreeting } from "../../../features/morning-greeting";
import { OllamaClient } from "../../../integrations/ollama/client";

type Command = CommandContext<Context>;

/** An LLM heckle on demand, from the chat's recent messages; the argument overrides the trigger. */
export async function forceHeckle(ctx: Command, ollama: OllamaClient): Promise<unknown> {
  const trigger = ctx.match?.trim() || ctx.message?.text || "Sakke";
  return ctx.reply(await llmHeckle(ollama, ctx.chat.id, trigger));
}

export async function sendMorningGreetingNow(ctx: Command, deps: MorningGreetingDependencies): Promise<void> {
  await sendMorningGreeting(deps, ctx.chat.id);
}
