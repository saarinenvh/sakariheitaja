import { join } from "path";
import { createJsonStore } from "../../../shared/jsonStore";
import { readConfig } from "../../../config";
import { finalTotals } from "../../../integrations/metrix/round/results";
import { TrackedRoundPlayer } from "../../../integrations/metrix/round/types";
import { moduleLogger } from "../../../shared/logger";
import { escapeHtml } from "../../../shared/html";

const log = moduleLogger("bagtags");

const DATA_DIR = readConfig().dataDir;
const BAGTAGS_PATH = DATA_DIR
  ? join(DATA_DIR, "bagtags.json")
  : join(__dirname, "../../../bot/system-prompts/bagtags.json");

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

export interface BagtagSwap {
  playerName: string;
  from: number;
  to: number;
}

export interface BagtagRoundResult {
  swaps: BagtagSwap[];
  unchanged: { playerName: string; tag: number }[];
  noTag: string[];
}

/** A tracked player at round end: tags swap within a group, by result, DNF players last. */
export interface BagtagParticipant {
  playerName: string;
  relativeToPar: number | null;
  group: string;
  dnf: boolean;
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
  const chatTags: Record<string, number> = { ...(store[chatKey] ?? {}) };

  // Partition by group
  const groups = new Map<string, BagtagParticipant[]>();
  for (const player of participants) {
    if (!groups.has(player.group)) groups.set(player.group, []);
    groups.get(player.group)!.push(player);
  }

  const swaps: BagtagSwap[] = [];
  const unchanged: { playerName: string; tag: number }[] = [];
  const noTag: string[] = [];
  const updatedTags = { ...chatTags };

  // Track who has no tag at all
  for (const player of participants) {
    if (chatTags[player.playerName] == null) noTag.push(player.playerName);
  }

  for (const [, groupPlayers] of groups) {
    const tagHolders = groupPlayers.filter(p => chatTags[p.playerName] != null);
    if (tagHolders.length < 2) {
      // No swap — just record unchanged
      for (const p of tagHolders) {
        unchanged.push({ playerName: p.playerName, tag: chatTags[p.playerName] });
      }
      continue;
    }

    // Sort: active players by Diff ascending, DNF players last
    const sorted = [...tagHolders].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.relativeToPar === null || b.relativeToPar === null) return 0;
      return a.relativeToPar - b.relativeToPar;
    });

    // Collect tags sorted ascending (best player gets lowest tag)
    const tags = sorted.map(p => chatTags[p.playerName]).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];
      const newTag = tags[i];
      const oldTag = chatTags[player.playerName];
      if (newTag !== oldTag) {
        swaps.push({ playerName: player.playerName, from: oldTag, to: newTag });
        updatedTags[player.playerName] = newTag;
      } else {
        unchanged.push({ playerName: player.playerName, tag: oldTag });
      }
    }
  }

  if (swaps.length > 0) {
    store[chatKey] = updatedTags;
    save(store);
    log.info({ chatId, swaps: swaps.map(s => `${s.playerName} ${s.from}→${s.to}`) }, "bagtag swaps applied");
  }

  return { swaps, unchanged, noTag };
}

export function formatBagtagAnnouncement(result: BagtagRoundResult): string {
  if (result.swaps.length === 0 && result.noTag.length === 0) {
    return "🏷️ Tägit tarkistettu — ei vaihtoja tällä kertaa.";
  }

  // The early return above only fires when there are no swaps AND nobody is
  // missing a tag - so a round where nothing changed but someone had no tag
  // still announced "Bag Tag vaihdettu!" under a list of unchanged tags.
  let msg = result.swaps.length > 0
    ? "🏷️ <b>Bag Tag vaihdettu!</b>\n\n"
    : "🏷️ <b>Tägit tarkistettu</b> — ei vaihtoja tällä kertaa.\n\n";

  for (const swap of result.swaps) {
    msg += `${escapeHtml(swap.playerName)}: #${swap.from} → <b>#${swap.to}</b>\n`;
  }

  for (const u of result.unchanged) {
    msg += `${escapeHtml(u.playerName)}: #${u.tag} (pysyy)\n`;
  }

  if (result.noTag.length > 0) {
    msg += `\nIlman tägiä: ${result.noTag.map(escapeHtml).join(", ")}\n`;
    msg += `Aseta tägi: /bagtag set [nimi] [numero]`;
  }

  return msg;
}

export function formatBagtagList(chatId: number): string {
  const tags = getAllBagtags(chatId);
  const entries = Object.entries(tags).sort((a, b) => a[1] - b[1]);

  if (entries.length === 0) {
    return "Ei täginomistajia vielä. Lisää: /bagtag set [nimi] [numero]";
  }

  let msg = "🏷️ <b>Bag Tag tilanne:</b>\n\n";
  for (const [name, tag] of entries) {
    msg += `#${tag} — ${escapeHtml(name)}\n`;
  }
  return msg;
}
