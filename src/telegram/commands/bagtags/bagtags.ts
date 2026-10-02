import { CommandContext, Context } from "grammy";
import {
  formatBagtagList,
  setBagtag,
  removeBagtag,
} from "../../../features/bagtags/bagtags";
import { HTML_NO_PREVIEW } from "../../sendOptions";

/** /bagtag lists the tags; "set [nimi] [numero]" and "remove [nimi]" change them. */
export async function manageBagtags(ctx: CommandContext<Context>): Promise<unknown> {
  const args = (ctx.match ?? "").trim();

  // /bagtag  — list current standings
  if (!args) {
    return ctx.reply(formatBagtagList(ctx.chat.id), HTML_NO_PREVIEW);
  }

  // /bagtag set <nimi> <numero>
  if (args.startsWith("set ")) {
    const parts = args.slice(4).trim().split(" ");
    if (parts.length < 2) return ctx.reply("Käyttö: /bagtag set [nimi] [numero]");

    const tagStr = parts[parts.length - 1];
    const tag = parseInt(tagStr, 10);
    if (isNaN(tag) || tag < 1) return ctx.reply("Anna kelvollinen taginumero. Esim: /bagtag set Matti Meikäläinen 7");

    const name = parts.slice(0, -1).join(" ");
    setBagtag(ctx.chat.id, name, tag);
    return ctx.reply(`✅ ${name} → tägi #${tag}`);
  }

  // /bagtag remove <nimi>
  if (args.startsWith("remove ")) {
    const name = args.slice(7).trim();
    if (!name) return ctx.reply("Anna pelaajan nimi. Esim: /bagtag remove Matti Meikäläinen");
    const removed = removeBagtag(ctx.chat.id, name);
    return ctx.reply(removed ? `🗑️ ${name} poistettu tägilistalta.` : `Pelaajaa ${name} ei löydy tägilistalta.`);
  }

  return ctx.reply("Käyttö:\n/bagtag — näytä tägilista\n/bagtag set [nimi] [numero] — aseta tägi\n/bagtag remove [nimi] — poista tägi");
}
