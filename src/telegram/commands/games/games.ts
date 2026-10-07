import { CommandContext, Context } from "grammy";
import { announcePlan, todaysPlans } from "../../../features/games";
import { getRandom } from "../../../shared/utils";
import { moduleLogger } from "../../../shared/logger";
import { wait } from "../../../shared/time";
import { gameMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

const log = moduleLogger("games");

const MAX_REPEATS = 100;
const COUNTDOWN_STEPS = ["3", "2", "1"];
const COUNTDOWN_STEP_MS = 1000;

export async function cheer(ctx: Command): Promise<unknown> {
  return ctx.reply("Hyvä Vade" + "e".repeat(getRandom(MAX_REPEATS)) + "!".repeat(getRandom(MAX_REPEATS)));
}

/**
 * Draws the score keeper among the names, after a 3-2-1 countdown. The countdown runs in the
 * background: updates are handled one at a time, so awaiting it would hold up the bot for its four seconds.
 */
export async function drawScorekeeper(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.kukakirjaaUsage);

  const players = ctx.match.split(" ");
  const winner = players[getRandom(players.length)];

  await ctx.reply(MSG.kukakirjaaIntro);

  runCountdown(ctx, winner).catch(err => log.warn({ chatId: ctx.chat.id, err }, "scorekeeper countdown failed"));
}

/** A step a second, then the winner; a failed reply ends the countdown. */
async function runCountdown(ctx: Command, winner: string): Promise<void> {
  for (const step of [...COUNTDOWN_STEPS, MSG.kukakirjaaWinner(winner.toUpperCase())]) {
    await wait(COUNTDOWN_STEP_MS);
    await ctx.reply(step);
  }
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
