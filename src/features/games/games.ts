import { addIfAbsent } from "../chats";
import { dayInTimeZone } from "../../shared/time";
import { readFixedForm } from "./fixedForm";
import { checkPlanDay, PLAN_TIME_ZONE } from "./policy";
import * as plans from "./db/gamePlanRepository";
import { GamePlan } from "./db/GamePlan.entity";

// Game planning (/hep, /pelei, /mukaan, /pois, /peru): plans for today or days ahead, per chat.

/** A Telegram user: their id, and the name the bot shows for them. */
export interface Member {
  telegramUserId: number;
  name: string;
}

/** The chat a command came from. */
export interface PlanChat {
  id: number;
  name: string;
}

/** `free-text`: not the fixed form; read by the model in a later phase. */
export type MakePlanResult =
  | { kind: "saved"; plan: GamePlan }
  | { kind: "free-text" }
  | { kind: "no-courses" }
  | { kind: "past" }
  | { kind: "too-far"; maxDaysAhead: number };

export type JoinResult = { kind: "joined" } | { kind: "already" } | { kind: "no-plan" };
export type LeaveResult = { kind: "left" } | { kind: "not-in-plan" } | { kind: "no-plan" };
export type CancelResult = { kind: "cancelled" } | { kind: "not-creator" } | { kind: "no-plan" };

/** Who leaves a plan: a member by their Telegram id, or a player by name. */
export type Leaver = { kind: "member"; telegramUserId: number } | { kind: "name"; name: string };

/** Saves a plan written in the fixed form. Its creator is its first player: the fixed form means "I'm going". */
export async function makePlan(chat: PlanChat, creator: Member, text: string, now = new Date()): Promise<MakePlanResult> {
  const today = dayInTimeZone(now, PLAN_TIME_ZONE);

  const reading = readFixedForm(text, today);
  if (reading.kind !== "plan") return reading;

  const dayCheck = checkPlanDay(reading.draft.day, today);
  if (dayCheck.kind !== "ok") return dayCheck;

  await addIfAbsent(chat.id, chat.name);
  const planId = await plans.create(
    { chatId: chat.id, creatorTelegramId: creator.telegramUserId, creatorName: creator.name, ...reading.draft, text },
    [{ name: creator.name, telegramUserId: creator.telegramUserId }],
  );

  return { kind: "saved", plan: await findSaved(planId, chat.id) };
}

/** The chat's plans from today on. */
export async function listPlans(chatId: number, now = new Date()): Promise<GamePlan[]> {
  return plans.findFromDay(chatId, dayInTimeZone(now, PLAN_TIME_ZONE));
}

/** Adds a member (with their Telegram id) or a name (without one) to the chat's plan. */
export async function joinPlan(chatId: number, planId: number, player: plans.PlanPlayer): Promise<JoinResult> {
  if (!(await plans.findInChat(planId, chatId))) return { kind: "no-plan" };

  return (await plans.addPlayer(planId, player)) ? { kind: "joined" } : { kind: "already" };
}

export async function leavePlan(chatId: number, planId: number, leaver: Leaver): Promise<LeaveResult> {
  if (!(await plans.findInChat(planId, chatId))) return { kind: "no-plan" };

  const removed = leaver.kind === "member"
    ? await plans.removePlayerByTelegramId(planId, leaver.telegramUserId)
    : await plans.removePlayerByName(planId, leaver.name);

  return removed ? { kind: "left" } : { kind: "not-in-plan" };
}

/** Deletes the chat's plan, for its creator only. */
export async function cancelPlan(chatId: number, planId: number, requesterTelegramId: number): Promise<CancelResult> {
  const plan = await plans.findInChat(planId, chatId);
  if (!plan) return { kind: "no-plan" };
  if (plan.creatorTelegramId !== requesterTelegramId) return { kind: "not-creator" };

  await plans.deleteById(planId);

  return { kind: "cancelled" };
}

/** The plan just saved, read back with its players for the confirmation. */
async function findSaved(planId: number, chatId: number): Promise<GamePlan> {
  const plan = await plans.findInChat(planId, chatId);
  if (!plan) throw new Error(`Game plan ${planId} was saved but can't be read back`);

  return plan;
}
