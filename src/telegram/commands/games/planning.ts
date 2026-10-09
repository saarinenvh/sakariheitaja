import { CommandContext, Context } from "grammy";
import type { Message } from "grammy/types";
import {
  CancelResult, cancelPlan, formatPlanSummary, GamePlan, JoinResult, joinPlan, Leaver, LeaveResult, leavePlan, listPlans, makePlan,
  MakePlanResult, Member, PlanPlayer,
} from "../../../features/games";
import { packLines } from "../../../shared/telegramText";
import { editBotPin, removeBotPin, replaceBotPin } from "../../botPin";
import { planningMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

/**
 * `/hep <text>`: a plan in the fixed form, with its creator as the first player. The confirmation
 * comes with the chat's whole list, which the bot pins in place of its previous pin.
 */
export async function makeGamePlan(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.hepUsage);

  const creator = senderOf(ctx);
  if (!creator) return ctx.reply(MSG.noSender);

  const result = await makePlan({ id: ctx.chat.id, name: ctx.chat.title ?? "" }, creator, ctx.match);
  if (result.kind !== "saved") return ctx.reply(formatRejectedPlan(result));

  const plans = await listPlans(ctx.chat.id);

  const [listMessage] = await replyInParts(ctx, [MSG.hepSaved(result.plan.id, formatPlanSummary(result.plan)), "", ...formatPlanList(plans)]);
  await replaceBotPin(ctx.api, ctx.chat.id, listMessage.message_id);
}

/** `/hepit`: the chat's plans from today on, in as many replies as Telegram's length limit needs. */
export async function listGamePlans(ctx: Command): Promise<unknown> {
  const plans = await listPlans(ctx.chat.id);
  if (plans.length === 0) return ctx.reply(MSG.hepitNone);

  return replyInParts(ctx, formatPlanList(plans));
}

/** `/mukaan <nr> [name]`: you, by your Telegram id, or any name. */
export async function joinGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("mukaan"));

  const player = playerFor(ctx, args.name);
  if (!player) return ctx.reply(MSG.noSender);

  const result = await joinPlan(ctx.chat.id, args.planId, player);

  await ctx.reply(formatJoinResult(result, player.name, args.planId));
  if (result.kind === "joined") await refreshPinnedList(ctx);
}

/** `/pois <nr> [name]`: you, by your Telegram id, or a name added without one. */
export async function leaveGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("pois"));

  const leaving = leaverFor(ctx, args.name);
  if (!leaving) return ctx.reply(MSG.noSender);

  const result = await leavePlan(ctx.chat.id, args.planId, leaving.leaver);

  await ctx.reply(formatLeaveResult(result, leaving.name, args.planId));
  if (result.kind === "left") await refreshPinnedList(ctx);
}

/** `/peru <nr>`: deletes the plan, for its creator only. */
export async function cancelGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("peru"));

  const sender = senderOf(ctx);
  if (!sender) return ctx.reply(MSG.noSender);

  const result = await cancelPlan(ctx.chat.id, args.planId, sender.telegramUserId);

  await ctx.reply(formatCancelResult(result, args.planId));
  if (result.kind === "cancelled") await refreshPinnedList(ctx);
}

/**
 * Brings the bot's pinned list up to date after a change, quietly, by editing it; with no plans
 * left, unpins it. A list longer than one message keeps its first part pinned.
 */
async function refreshPinnedList(ctx: Command): Promise<void> {
  const plans = await listPlans(ctx.chat.id);
  if (plans.length === 0) return removeBotPin(ctx.api, ctx.chat.id);

  const [firstPart] = packLines(formatPlanList(plans));

  await editBotPin(ctx.api, ctx.chat.id, firstPart);
}

/** The lines in as few replies as fit, in order; a line too long for one reply is cut short. */
async function replyInParts(ctx: Command, lines: readonly string[]): Promise<Message[]> {
  const sent: Message[] = [];
  for (const text of packLines(lines)) sent.push(await ctx.reply(text));

  return sent;
}

/** The `/hepit` list: a header, a line per plan with its number, and how to join. */
function formatPlanList(plans: readonly GamePlan[]): string[] {
  const planLines = plans.map(plan => `${plan.id}. ${formatPlanSummary(plan)}`);

  return [MSG.hepitHeader, "", ...planLines, "", MSG.hepitFooter];
}

function formatRejectedPlan(result: Exclude<MakePlanResult, { kind: "saved" }>): string {
  switch (result.kind) {
    case "free-text": return MSG.hepFreeText;
    case "no-courses": return MSG.hepNoCourses;
    case "past": return MSG.hepPast;
    case "too-far": return MSG.hepTooFar(result.maxDaysAhead);
  }
}

function formatJoinResult(result: JoinResult, name: string, planId: number): string {
  switch (result.kind) {
    case "joined": return MSG.joined(name, planId);
    case "already": return MSG.alreadyIn(name);
    case "no-plan": return MSG.noPlan;
    case "name-too-long": return MSG.nameTooLong(result.maxLength);
  }
}

function formatLeaveResult(result: LeaveResult, name: string, planId: number): string {
  switch (result.kind) {
    case "left": return MSG.left(name, planId);
    case "not-in-plan": return MSG.notInPlan(name);
    case "no-plan": return MSG.noPlan;
  }
}

function formatCancelResult(result: CancelResult, planId: number): string {
  switch (result.kind) {
    case "cancelled": return MSG.cancelled(planId);
    case "not-creator": return MSG.notCreator;
    case "no-plan": return MSG.noPlan;
  }
}

/** The plan number first, then an optional name, which may have spaces. */
function readPlanArgs(match: string | undefined): { planId: number; name: string | null } | null {
  const [number, ...nameWords] = (match ?? "").trim().split(/\s+/);
  const planId = Number(number);
  if (!Number.isInteger(planId) || planId <= 0) return null;

  const name = nameWords.join(" ").trim();

  return { planId, name: name || null };
}

/** The sender, shown by their first name; null without one (e.g. a channel post). */
function senderOf(ctx: Command): Member | null {
  return ctx.from ? { telegramUserId: ctx.from.id, name: ctx.from.first_name } : null;
}

/** A named player has no Telegram id; without a name, it's the sender. */
function playerFor(ctx: Command, name: string | null): PlanPlayer | null {
  if (name) return { name, telegramUserId: null };

  const sender = senderOf(ctx);

  return sender ? { name: sender.name, telegramUserId: sender.telegramUserId } : null;
}

/** Who `/pois` removes, and the name the reply uses: a given name, or the sender by their Telegram id. */
function leaverFor(ctx: Command, name: string | null): { leaver: Leaver; name: string } | null {
  if (name) return { leaver: { kind: "name", name }, name };

  const sender = senderOf(ctx);

  return sender ? { leaver: { kind: "member", telegramUserId: sender.telegramUserId }, name: sender.name } : null;
}
