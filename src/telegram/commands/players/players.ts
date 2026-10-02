import { Composer } from "grammy";
import * as playerService from "../../../features/players/players";
import { players as MSG } from "../../messages";

export const players = new Composer();

// /lisaa <player name>
// Adds a player to the tracked player list for this chat.
// If the player doesn't exist in the database yet, they are created automatically.
// Replies with a confirmation or a notice if the player is already being tracked.
players.command("lisaa", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.lisaaUsage);
  const chatId = ctx.chat.id;
  try {
    const result = await playerService.addToGroup(ctx.match, chatId);
    await ctx.reply(result.added ? MSG.playerAdded(ctx.match) : MSG.playerAlreadyAdded(ctx.match));
  } catch {
    await ctx.reply(MSG.lisaaError);
  }
});

// /poista <player name>
// Removes a player from the tracked player list for this chat.
// The player record itself is kept in the database; only the chat link is removed.
players.command("poista", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.poistaUsage);
  const chatId = ctx.chat.id;
  try {
    const result = await playerService.removeFromGroup(ctx.match, chatId);
    if (!result.found) return ctx.reply(MSG.playerNotInSystem(ctx.match));
    await ctx.reply(result.removed ? MSG.playerRemoved(ctx.match) : MSG.playerNotTracked(ctx.match));
  } catch {
    await ctx.reply(MSG.poistaError);
  }
});

// /pelaajat
// Lists all players currently tracked in this chat.
players.command("pelaajat", async ctx => {
  const list = await playerService.getGroupPlayers(ctx.chat.id);
  let message = MSG.pelaajatHeader;
  list.forEach(p => (message += `${p.name} \n`));
  await ctx.reply(message);
});
