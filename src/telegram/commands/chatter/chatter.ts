import { Context, Filter } from "grammy";
import { heckle, recordMessage, getRecentMessages } from "../../../features/heckler";
import { llmAnswer } from "../../../features/match-play-asker";
import { CommandDependencies } from "../types";
import { moduleLogger } from "../../../shared/logger";
import { getRandom } from "../../../shared/utils";
import { JALLU_REPLY, randomQuote, sakariNames } from "./phrases";

const log = moduleLogger("chatter");

const JALLU_ODDS = 2;
const RANDOM_QUOTE_ODDS = 40;

/**
 * Reacts to ordinary messages: answers when Sakari is named, sometimes shouts back at "jallu",
 * and now and then drops a random quote. Every message is remembered for the heckler.
 */
export async function reactToMessage(ctx: Filter<Context, "message:text">, deps: CommandDependencies): Promise<void> {
  const text = ctx.message.text;
  recordMessage(ctx.chat.id, text);

  if (sakariNames.find(name => text.toLowerCase().includes(name.toLowerCase()))) {
    // Not awaited: grammY handles updates one at a time, and a model reply would hold up every chat.
    void answerMention(ctx, deps, text).catch(err => log.warn({ err }, "mention reply failed"));
    return;
  }

  if (text.includes("jallu") && getRandom(JALLU_ODDS) === 1) {
    await ctx.reply(JALLU_REPLY);
    return;
  }

  if (getRandom(RANDOM_QUOTE_ODDS) === 1) {
    await ctx.reply(randomQuote[getRandom(randomQuote.length)]);
  }
}

async function answerMention(ctx: Filter<Context, "message:text">, deps: CommandDependencies, text: string): Promise<void> {
  if (deps.llmEnabled) {
    const senderName = ctx.from?.first_name ?? ctx.from?.username;
    const answer = await llmAnswer(deps, text, senderName, getRecentMessages(ctx.chat.id));
    if (answer) {
      await ctx.reply(answer);
      return;
    }
  }
  if (getRandom(2) === 1) {
    await ctx.reply(await heckle(deps.ollama, ctx.chat.id, text, deps.llmEnabled));
  }
}
