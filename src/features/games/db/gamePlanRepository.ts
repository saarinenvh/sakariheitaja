import { Between, IsNull, MoreThanOrEqual } from "typeorm";
import { dataSource } from "../../../db/dataSource";
import { insertedRow } from "../../../db/insertResult";
import { GamePlan } from "./GamePlan.entity";
import { GamePlanPlayer } from "./GamePlanPlayer.entity";

/** A plan before it's saved. */
export interface NewGamePlan {
  chatId: number;
  creatorTelegramId: number;
  creatorName: string;
  /** `YYYY-MM-DD`. */
  day: string;
  /** `HH:MM`, or null. */
  startTime: string | null;
  courses: string[];
  text: string;
}

/** A player as saved: a name, and the Telegram id when it's known. */
export interface PlanPlayer {
  name: string;
  telegramUserId: number | null;
}

function plans() {
  return dataSource.getRepository(GamePlan);
}

function players() {
  return dataSource.getRepository(GamePlanPlayer);
}

/** Saves the plan and its players together, and returns the plan's number. A name given twice is kept once. */
export async function create(plan: NewGamePlan, planPlayers: readonly PlanPlayer[]): Promise<number> {
  return dataSource.transaction(async manager => {
    const result = await manager.insert(GamePlan, plan);
    const planId = result.identifiers[0].id as number;

    if (planPlayers.length > 0) {
      const rows = planPlayers.map(player => ({ ...player, planId }));
      await manager.createQueryBuilder().insert().into(GamePlanPlayer).values(rows).orIgnore().execute();
    }

    return planId;
  });
}

/** The plan with its players, when it was made in this chat. */
export async function findInChat(id: number, chatId: number): Promise<GamePlan | null> {
  return plans().findOne({ where: { id, chatId }, relations: { players: true }, order: { players: { id: "ASC" } } });
}

/** The chat's plans on `day` or later, by day, time and number, with their players. */
export async function findFromDay(chatId: number, day: string): Promise<GamePlan[]> {
  return plans().find({
    where: { chatId, day: MoreThanOrEqual(day) },
    relations: { players: true },
    order: { day: "ASC", startTime: "ASC", id: "ASC", players: { id: "ASC" } },
  });
}

/** The chat's plans from `fromDay` to `toDay`, both included, in the same order as `findFromDay`. */
export async function findBetween(chatId: number, fromDay: string, toDay: string): Promise<GamePlan[]> {
  return plans().find({
    where: { chatId, day: Between(fromDay, toDay) },
    relations: { players: true },
    order: { day: "ASC", startTime: "ASC", id: "ASC", players: { id: "ASC" } },
  });
}

/** False when the player is in the plan already: the same Telegram id, or the same name without one. */
export async function addPlayer(planId: number, player: PlanPlayer): Promise<boolean> {
  const result = await players().createQueryBuilder().insert().into(GamePlanPlayer)
    .values({ ...player, planId }).orIgnore().execute();

  return insertedRow(result);
}

export async function removePlayerByTelegramId(planId: number, telegramUserId: number): Promise<boolean> {
  const result = await players().delete({ planId, telegramUserId });

  return (result.affected ?? 0) > 0;
}

/** Removes the player without a Telegram id who has that name, ignoring case. */
export async function removePlayerByName(planId: number, name: string): Promise<boolean> {
  const result = await players().delete({ planId, name, telegramUserId: IsNull() });

  return (result.affected ?? 0) > 0;
}

/** Deletes the plan and its players. */
export async function deleteById(id: number): Promise<boolean> {
  const result = await plans().delete(id);

  return (result.affected ?? 0) > 0;
}
