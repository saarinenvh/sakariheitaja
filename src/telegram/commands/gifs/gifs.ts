import { CommandContext, Context } from "grammy";
import { giphy } from "../../../integrations/giphy";
import { gameMessages as MSG } from "../games/messages";

export async function sendGif(ctx: CommandContext<Context>): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.gifplzUsage);
  const gifUrl = await giphy.searchGif(ctx.match);
  if (gifUrl) await ctx.replyWithVideo(gifUrl);
}
