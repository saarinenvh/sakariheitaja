import { join } from "path";
import { createJsonStore } from "../../shared/jsonStore";
import { readConfig } from "../../config";
import { finalTotals } from "../../integrations/metrix/round/results";
import { TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { moduleLogger } from "../../shared/logger";
import { BagtagParticipant, BagtagRoundResult, reallocateBagtags } from "./policy";

const log = moduleLogger("bagtags");

const DATA_DIR = readConfig().dataDir;
const BAGTAGS_PATH = DATA_DIR
  ? join(DATA_DIR, "bagtags.json")
  : join(__dirname, "../../data/bagtags.json");

type BagtagStore = Record<string, Record<string, number>>; // chatId → name → tagNumber

const bagtagStore = createJsonStore<BagtagStore>(BAGTAGS_PATH, () => ({}));

function load(): BagtagStore {
  return bagtagStore.load();
}

function save(store: BagtagStore): void {
  bagtagStore.save(store);
}

export function getBagtag(chatId: number, name: string): number | null {
  return load()[String(chatId)]?.[name] ?? null;
}

export function setBagtag(chatId: number, name: string, tag: number): void {
  const store = load();
  const key = String(chatId);
  if (!store[key]) store[key] = {};
  store[key][name] = tag;
  save(store);
}

export function removeBagtag(chatId: number, name: string): boolean {
  const store = load();
  const key = String(chatId);
  if (!store[key]?.[name]) return false;
  delete store[key][name];
  save(store);
  return true;
}

export function getAllBagtags(chatId: number): Record<string, number> {
  return load()[String(chatId)] ?? {};
}

export function getMissingTagPlayers(chatId: number, trackedPlayers: readonly { Name: string }[]): string[] {
  const tags = getAllBagtags(chatId);
  return trackedPlayers.filter(p => tags[p.Name] == null).map(p => p.Name);
}

export function selectBagtagParticipants(players: readonly TrackedRoundPlayer[]): BagtagParticipant[] {
  return players.map(({ player }) => ({
    playerName: player.name, relativeToPar: finalTotals(player).relativeToPar,
    group: player.group || "1", dnf: player.round.status === "dnf",
  }));
}

export function computeAndApplySwaps(chatId: number, participants: readonly BagtagParticipant[]): BagtagRoundResult {
  const store = load();
  const chatKey = String(chatId);
  const { updatedTags, ...result } = reallocateBagtags({ ...(store[chatKey] ?? {}) }, participants);

  if (result.swaps.length > 0) {
    store[chatKey] = updatedTags;
    save(store);
    log.info({ chatId, swaps: result.swaps.map(s => `${s.playerName} ${s.from}→${s.to}`) }, "bagtag swaps applied");
  }

  return result;
}
