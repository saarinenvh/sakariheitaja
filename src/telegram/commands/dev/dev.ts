import { CommandContext, Context } from "grammy";
import { llmHeckle } from "../../../features/heckler/heckler";
import { sendMorningGreeting } from "../../../features/morning-greeting/morningGreeting";
import { morningGreetingDependencies } from "../../dependencies";

type Command = CommandContext<Context>;

/** An LLM heckle on demand, from the chat's recent messages; the argument overrides the trigger. */
export async function forceHeckle(ctx: Command): Promise<unknown> {
  const trigger = ctx.match?.trim() || ctx.message?.text || "Sakke";
  return ctx.reply(await llmHeckle(ctx.chat.id, trigger));
}

export async function sendMorningGreetingNow(ctx: Command): Promise<void> {
  await sendMorningGreeting(morningGreetingDependencies, ctx.chat.id);
}
