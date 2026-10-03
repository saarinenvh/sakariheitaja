import { escapeHtml } from "../../shared/html";
import { BagtagRoundResult } from "./policy";

/** The round end's bagtag message: the swaps, the tags that stayed, and who has no tag. */
export function formatBagtagAnnouncement(result: BagtagRoundResult): string {
  if (result.swaps.length === 0 && result.noTag.length === 0) {
    return "🏷️ Tägit tarkistettu — ei vaihtoja tällä kertaa.";
  }

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

/** `/bagtag`: the chat's tags, lowest number first. */
export function formatBagtagList(tags: Readonly<Record<string, number>>): string {
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
