import { Composer } from "grammy";
import { getRandom } from "../../shared/utils";
import { searchGiphy } from "../../shared/giphy";
import { sakariNames, randomQuote } from "../../config/phrases";
import { fun as MSG } from "../../config/messages";
import { heckle, llmHeckle, recordMessage, getRecentMessages } from "../llmHeckler";
import { llmAnswer } from "../llmAsker";
import { sendMorningGreeting } from "../../scheduler/morningGreeter";

let games: Record<string, string> = {};
let date = new Date().toLocaleDateString();

export const fun = new Composer();

// /hyva
// Replies with an enthusiastic "Hyvä Vadee!" with a random number of repeated letters.
fun.command("hyva", async ctx => {
  await ctx.reply("Hyvä Vade" + "e".repeat(getRandom(100)) + "!".repeat(getRandom(100)));
});

// /isit
// Replies with "Hyvä isit!" with a random number of repeated letters.
fun.command("isit", async ctx => {
  await ctx.reply("Hyvä isi" + "t".repeat(getRandom(100)) + "!".repeat(getRandom(100)));
});

// /kukakirjaa <name1> <name2> ...
// Randomly picks one of the given names as the designated score keeper.
// Builds up suspense with a 3-2-1 countdown before revealing the winner.
fun.command("kukakirjaa", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.kukakirjaaUsage);
  const players = ctx.match.split(" ");
  const winner = players[getRandom(players.length)];
  await ctx.reply(MSG.kukakirjaaIntro);
  setTimeout(() => ctx.reply("3"), 1000);
  setTimeout(() => ctx.reply("2"), 2000);
  setTimeout(() => ctx.reply("1"), 3000);
  setTimeout(() => ctx.reply(MSG.kukakirjaaWinner(winner.toUpperCase())), 4000);
});

// /gifplz <search term>
// Searches Giphy for a matching GIF/video and sends a random result.
fun.command("gifplz", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.gifplzUsage);
  const gifUrl = await searchGiphy(ctx.match);
  if (gifUrl) await ctx.replyWithVideo(gifUrl);
});

// /hep <plan>
// Lets a user announce what disc golf game they're planning today.
// Plans are stored per username and reset each day at midnight.
fun.command("hep", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.hepUsage);
  if (new Date().toLocaleDateString() !== date) {
    games = {};
    date = new Date().toLocaleDateString();
  }
  const username = ctx.from?.username ?? ctx.from?.first_name ?? "tuntematon";
  games[username] = ctx.match;
  await ctx.reply(_todaysGames());
});

// /pelei
// Shows today's game plans announced by all users via /hep.
fun.command("pelei", async ctx => {
  await ctx.reply(_todaysGames());
});

// /apua
// Prints the full list of available bot commands with short descriptions.
fun.command("apua", async ctx => {
  await ctx.reply(MSG.apua);
});

// /heckle [message]
// Dev command (only active when LLM_ENABLED=true): forces an LLM heckler response
// using the chat's message buffer. Optional argument overrides the trigger message.
if (process.env.LLM_ENABLED === "true") {
  fun.command("heckle", async ctx => {
    const trigger = ctx.match?.trim() || ctx.message?.text || "Sakke";
    const reply = await llmHeckle(ctx.chat.id, trigger);
    await ctx.reply(reply);
  });

  fun.command("aamuu", async ctx => {
    await sendMorningGreeting(ctx.api, ctx.chat.id);
  });
}

// Passive listener — must stay last in middleware registration.
// Reacts to regular text messages (not commands) with random bot personality:
// - Responds to messages containing Sakari's name (~50% chance)
// - Responds to "jallu" mentions (~50% chance)
// - Sends a random quote to any message (~1 in 40 chance)
// Does not call next(), so it must be registered after all command handlers.
fun.on("message:text", async ctx => {
  const text = ctx.message.text;
  recordMessage(ctx.chat.id, text);
  let said = false;

  if (sakariNames.find(name => text.toLowerCase().includes(name.toLowerCase()))) {
    if (process.env.LLM_ENABLED === "true") {
      const senderName = ctx.from?.first_name ?? ctx.from?.username;
      const answer = await llmAnswer(text, senderName, getRecentMessages(ctx.chat.id));
      if (answer) {
        await ctx.reply(answer);
        said = true;
      }
    }
    if (!said && getRandom(2) === 1) {
      await ctx.reply(await heckle(ctx.chat.id, text));
      said = true;
    }
  }

  if (text.includes("jallu") && getRandom(2) === 1 && !said) {
    await ctx.reply(MSG.jallu);
    said = true;
  }

  if (getRandom(40) === 1 && !said) {
    await ctx.reply(randomQuote[getRandom(randomQuote.length)]);
  }
});

function _todaysGames(): string {
  if (Object.keys(games).length === 0) return MSG.peleiNone;
  let message = MSG.peleiHeader;
  for (const [user, plan] of Object.entries(games)) {
    message += `${user}: ${plan} \n`;
  }
  return message + MSG.peleiFooter;
}
