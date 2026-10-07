import { ScoreTracker } from "./liveScoring";

/** The rounds each chat follows right now, started or still starting; in memory, rebuilt on startup. */
const registry = new Map<number, ScoreTracker[]>();

/** Rounds a `/follow` is starting, by `reservationKey`: not trackers yet, but taken. */
const reservations = new Set<string>();

export function add(chatId: number, tracker: ScoreTracker): void {
  registry.set(chatId, [...tracked(chatId), tracker]);
}

/** Rounds that have started, scheduled ones included: what `/pelit`, `/top5` and `/score` show. */
export function getActive(chatId: number): ScoreTracker[] {
  return tracked(chatId).filter(tracker => tracker.started);
}

export function find(chatId: number, metrixId: string): ScoreTracker | undefined {
  return getActive(chatId).find(tracker => tracker.metrixId === metrixId);
}

/** The chat's round with that id, also one still starting: what `/lopeta` stops. */
export function findTracked(chatId: number, metrixId: string): ScoreTracker | undefined {
  return tracked(chatId).find(tracker => tracker.metrixId === metrixId);
}

/**
 * Takes the round for a `/follow` while it starts; false when the chat already follows it or another
 * `/follow` is starting it. Checked and taken without awaiting, so two `/follow`s can't both get it.
 */
export function reserve(chatId: number, metrixId: string): boolean {
  const key = reservationKey(chatId, metrixId);
  if (findTracked(chatId, metrixId) || reservations.has(key)) return false;

  reservations.add(key);
  return true;
}

export function release(chatId: number, metrixId: string): void {
  reservations.delete(reservationKey(chatId, metrixId));
}

/** Stops the round and forgets it. */
export function remove(chatId: number, tracker: ScoreTracker): void {
  tracker.stopFollowing();
  registry.set(chatId, tracked(chatId));
}

/** The chat's rounds, dropping the stopped ones. */
function tracked(chatId: number): ScoreTracker[] {
  const live = (registry.get(chatId) ?? []).filter(tracker => !tracker.stopped);
  registry.set(chatId, live);

  return live;
}

function reservationKey(chatId: number, metrixId: string): string {
  return `${chatId}:${metrixId}`;
}
