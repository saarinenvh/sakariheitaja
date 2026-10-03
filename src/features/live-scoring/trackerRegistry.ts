import { ScoreTracker } from "./liveScoring";

/** The rounds each chat follows right now; in memory, rebuilt on startup from unfinished competitions. */
const registry = new Map<number, ScoreTracker[]>();

export function add(chatId: number, tracker: ScoreTracker): void {
  if (!registry.has(chatId)) registry.set(chatId, []);
  registry.get(chatId)!.push(tracker);
}

export function getActive(chatId: number): ScoreTracker[] {
  const active = (registry.get(chatId) ?? []).filter(tracker => tracker.following);
  registry.set(chatId, active);
  return active;
}

export function find(chatId: number, metrixId: string): ScoreTracker | undefined {
  return getActive(chatId).find(tracker => tracker.metrixId === metrixId);
}

export function remove(chatId: number, metrixId: string): ScoreTracker | undefined {
  const active = getActive(chatId);
  const idx = active.findIndex(tracker => tracker.metrixId === metrixId);
  if (idx === -1) return undefined;
  const [tracker] = active.splice(idx, 1);
  tracker.stopFollowing();
  registry.set(chatId, active);
  return tracker;
}
