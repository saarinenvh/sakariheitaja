import { Orchestrator } from "./scoreTracker";

const registry = new Map<number, Orchestrator[]>();

export function add(chatId: number, orchestrator: Orchestrator): void {
  if (!registry.has(chatId)) registry.set(chatId, []);
  registry.get(chatId)!.push(orchestrator);
}

export function getActive(chatId: number): Orchestrator[] {
  const active = (registry.get(chatId) ?? []).filter(o => o.following);
  registry.set(chatId, active);
  return active;
}

export function find(chatId: number, metrixId: string): Orchestrator | undefined {
  return getActive(chatId).find(o => o.metrixId === metrixId);
}

export function remove(chatId: number, metrixId: string): Orchestrator | undefined {
  const active = getActive(chatId);
  const idx = active.findIndex(o => o.metrixId === metrixId);
  if (idx === -1) return undefined;
  const [orchestrator] = active.splice(idx, 1);
  orchestrator.stopFollowing();
  registry.set(chatId, active);
  return orchestrator;
}
