import { CommandContext, Context } from "grammy";
import {
  cancelPlan, formatPlanSummary, joinPlan, Leaver, leavePlan, listPlans, makePlan, MakePlanResult, Member, PlanPlayer,
} from "../../../features/games";
import { planningMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

/** `/hep <text>`: a plan in the fixed form, with its creator as the first player. */
export async function makeGamePlan(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.hepUsage);

  const creator = senderOf(ctx);
  if (!creator) return ctx.reply(MSG.noSender);

  const result = await makePlan({ id: ctx.chat.id, name: ctx.chat.title ?? "" }, creator, ctx.match);

  return ctx.reply(formatMakePlanResult(result));
}

/** `/hepit`: the chat's plans from today on. */
export async function listGamePlans(ctx: Command): Promise<unknown> {
  const plans = await listPlans(ctx.chat.id);
  if (plans.length === 0) return ctx.reply(MSG.hepitNone);

  const lines = plans.map(plan => `${plan.id}. ${formatPlanSummary(plan)}`);

  return ctx.reply(MSG.hepitHeader + lines.join("\n") + MSG.hepitFooter);
}

/** `/mukaan <nr> [name]`: you, by your Telegram id, or any name. */
export async function joinGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("mukaan"));

  const player = playerFor(ctx, args.name);
  if (!player) return ctx.reply(MSG.noSender);

  const result = await joinPlan(ctx.chat.id, args.planId, player);
  switch (result.kind) {
    case "joined": return ctx.reply(MSG.joined(player.name, args.planId));
    case "already": return ctx.reply(MSG.alreadyIn(player.name));
    case "no-plan": return ctx.reply(MSG.noPlan);
    case "name-too-long": return ctx.reply(MSG.nameTooLong(result.maxLength));
  }
}

/** `/pois <nr> [name]`: you, by your Telegram id, or a name added without one. */
export async function leaveGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("pois"));

  const leaving = leaverFor(ctx, args.name);
  if (!leaving) return ctx.reply(MSG.noSender);

  const result = await leavePlan(ctx.chat.id, args.planId, leaving.leaver);
  switch (result.kind) {
    case "left": return ctx.reply(MSG.left(leaving.name, args.planId));
    case "not-in-plan": return ctx.reply(MSG.notInPlan(leaving.name));
    case "no-plan": return ctx.reply(MSG.noPlan);
  }
}

/** `/peru <nr>`: deletes the plan, for its creator only. */
export async function cancelGamePlan(ctx: Command): Promise<unknown> {
  const args = readPlanArgs(ctx.match);
  if (!args) return ctx.reply(MSG.planNumberUsage("peru"));

  const sender = senderOf(ctx);
  if (!sender) return ctx.reply(MSG.noSender);

  const result = await cancelPlan(ctx.chat.id, args.planId, sender.telegramUserId);
  switch (result.kind) {
    case "cancelled": return ctx.reply(MSG.cancelled(args.planId));
    case "not-creator": return ctx.reply(MSG.notCreator);
    case "no-plan": return ctx.reply(MSG.noPlan);
  }
}

function formatMakePlanResult(result: MakePlanResult): string {
  switch (result.kind) {
    case "saved": return MSG.hepSaved(result.plan.id, formatPlanSummary(result.plan));
    case "free-text": return MSG.hepFreeText;
    case "no-courses": return MSG.hepNoCourses;
    case "past": return MSG.hepPast;
    case "too-far": return MSG.hepTooFar(result.maxDaysAhead);
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
