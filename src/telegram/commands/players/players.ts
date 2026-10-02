import { CommandContext, Context } from "grammy";
import * as playerService from "../../../features/players/players";
import { playerMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

/** Follows the named player in this chat, creating the player if they're new. */
export async function addPlayer(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.lisaaUsage);
  try {
    const result = await playerService.addToGroup(ctx.match, ctx.chat.id);
    return ctx.reply(result.added ? MSG.playerAdded(ctx.match) : MSG.playerAlreadyAdded(ctx.match));
  } catch {
    return ctx.reply(MSG.lisaaError);
  }
}

/** Stops following the player in this chat; the player record stays. */
export async function removePlayer(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.poistaUsage);
  try {
    const result = await playerService.removeFromGroup(ctx.match, ctx.chat.id);
    if (!result.found) return ctx.reply(MSG.playerNotInSystem(ctx.match));
    return ctx.reply(result.removed ? MSG.playerRemoved(ctx.match) : MSG.playerNotTracked(ctx.match));
  } catch {
    return ctx.reply(MSG.poistaError);
  }
}

export async function listPlayers(ctx: Command): Promise<unknown> {
  const list = await playerService.getGroupPlayers(ctx.chat.id);
  let message = MSG.pelaajatHeader;
  list.forEach(p => (message += `${p.name} \n`));
  return ctx.reply(message);
}
