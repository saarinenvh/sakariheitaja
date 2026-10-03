import { CommandContext, Context } from "grammy";
import { announcePlan, todaysPlans } from "../../../features/games";
import { getRandom } from "../../../shared/utils";
import { gameMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

const MAX_REPEATS = 100;
const COUNTDOWN_STEP_MS = 1000;

export async function cheer(ctx: Command): Promise<unknown> {
  return ctx.reply("Hyvä Vade" + "e".repeat(getRandom(MAX_REPEATS)) + "!".repeat(getRandom(MAX_REPEATS)));
}

export async function cheerIsit(ctx: Command): Promise<unknown> {
  return ctx.reply("Hyvä isi" + "t".repeat(getRandom(MAX_REPEATS)) + "!".repeat(getRandom(MAX_REPEATS)));
}

/** Draws the score keeper among the names, after a 3-2-1 countdown. */
export async function drawScorekeeper(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.kukakirjaaUsage);
  const players = ctx.match.split(" ");
  const winner = players[getRandom(players.length)];
  await ctx.reply(MSG.kukakirjaaIntro);
  setTimeout(() => ctx.reply("3"), COUNTDOWN_STEP_MS);
  setTimeout(() => ctx.reply("2"), 2 * COUNTDOWN_STEP_MS);
  setTimeout(() => ctx.reply("1"), 3 * COUNTDOWN_STEP_MS);
  setTimeout(() => ctx.reply(MSG.kukakirjaaWinner(winner.toUpperCase())), 4 * COUNTDOWN_STEP_MS);
}

export async function announceTodaysPlan(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.hepUsage);
  const user = ctx.from?.username ?? ctx.from?.first_name ?? "tuntematon";
  announcePlan(user, ctx.match);
  return ctx.reply(formatTodaysPlans());
}

export async function listTodaysPlans(ctx: Command): Promise<unknown> {
  return ctx.reply(formatTodaysPlans());
}

function formatTodaysPlans(): string {
  const plans = Object.entries(todaysPlans());
  if (plans.length === 0) return MSG.peleiNone;
  let message = MSG.peleiHeader;
  for (const [user, plan] of plans) {
    message += `${user}: ${plan} \n`;
  }
  return message + MSG.peleiFooter;
}
