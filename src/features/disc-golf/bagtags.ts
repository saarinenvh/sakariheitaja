import { join } from "path";
import { createJsonStore } from "../../shared/jsonStore";
import { MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";
import Logger from "js-logger";

const BAGTAGS_PATH = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, "bagtags.json")
  : join(__dirname, "../../bot/system-prompts/bagtags.json");

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

export function getMissingTagPlayers(chatId: number, trackedPlayers: TrackedPlayer[]): string[] {
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

export function computeAndApplySwaps(
  chatId: number,
  trackedPlayers: TrackedPlayer[],
  allResults: MetrixPlayerResult[],
): BagtagRoundResult {
  const store = load();
  const chatKey = String(chatId);
  const chatTags: Record<string, number> = { ...(store[chatKey] ?? {}) };

  // Enrich tracked players with Group and DNF from allResults
  const enriched = trackedPlayers.map(tp => {
    const full = allResults.find(r => r.Name === tp.Name);
    return {
      Name: tp.Name,
      Diff: tp.Diff,
      Group: full?.Group ?? "1",
      DNF: full?.DNF ?? null,
    };
  });

  // Partition by group
  const groups = new Map<string, typeof enriched>();
  for (const player of enriched) {
    if (!groups.has(player.Group)) groups.set(player.Group, []);
    groups.get(player.Group)!.push(player);
  }

  const swaps: BagtagSwap[] = [];
  const unchanged: { playerName: string; tag: number }[] = [];
  const noTag: string[] = [];
  const updatedTags = { ...chatTags };

  // Track who has no tag at all
  for (const player of enriched) {
    if (chatTags[player.Name] == null) noTag.push(player.Name);
  }

  for (const [, groupPlayers] of groups) {
    const tagHolders = groupPlayers.filter(p => chatTags[p.Name] != null);
    if (tagHolders.length < 2) {
      // No swap — just record unchanged
      for (const p of tagHolders) {
        unchanged.push({ playerName: p.Name, tag: chatTags[p.Name] });
      }
      continue;
    }

    // Sort: active players by Diff ascending, DNF players last
    const sorted = [...tagHolders].sort((a, b) => {
      if (a.DNF && !b.DNF) return 1;
      if (!a.DNF && b.DNF) return -1;
      return a.Diff - b.Diff;
    });

    // Collect tags sorted ascending (best player gets lowest tag)
    const tags = sorted.map(p => chatTags[p.Name]).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];
      const newTag = tags[i];
      const oldTag = chatTags[player.Name];
      if (newTag !== oldTag) {
        swaps.push({ playerName: player.Name, from: oldTag, to: newTag });
        updatedTags[player.Name] = newTag;
      } else {
        unchanged.push({ playerName: player.Name, tag: oldTag });
      }
    }
  }

  if (swaps.length > 0) {
    store[chatKey] = updatedTags;
    save(store);
    Logger.info(`Bagtag swaps applied for chat ${chatId}: ${swaps.map(s => `${s.playerName} ${s.from}→${s.to}`).join(", ")}`);
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
    msg += `${swap.playerName}: #${swap.from} → <b>#${swap.to}</b>\n`;
  }

  for (const u of result.unchanged) {
    msg += `${u.playerName}: #${u.tag} (pysyy)\n`;
  }

  if (result.noTag.length > 0) {
    msg += `\nIlman tägiä: ${result.noTag.join(", ")}\n`;
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
    msg += `#${tag} — ${name}\n`;
  }
  return msg;
}
