import { Composer } from "grammy";
import { Orchestrator } from "../../features/disc-golf/orchestrator";
import * as competitionService from "../../features/disc-golf/services/CompetitionService";
import * as registry from "../../state/competitionRegistry";
import { competition as MSG } from "../../config/messages";
import { HTML_NO_PREVIEW } from "../../config/bot";

export const competition = new Composer();

// /follow <metrixId>
// Starts tracking a disc golf competition from Disc Golf Metrix.
// Saves the competition to the database, creates an Orchestrator that polls
// for score updates, and announces tracked players in the chat.
competition.command("follow", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.followUsage);

  const metrixId = ctx.match.match(/\d+/)?.[0];
  if (!metrixId) return ctx.reply(MSG.followNoNumber);

  const chatId = ctx.chat.id;
  const result = await competitionService.start(chatId, ctx.chat.title ?? "", metrixId);

  const orchestrator = await new Orchestrator(result.insertId, metrixId, chatId).init();

  if (!orchestrator.following) {
    await ctx.reply(MSG.followInvalid);
    await competitionService.remove(String(result.insertId));
    return;
  }

  await ctx.reply(MSG.followStarted);
  registry.add(chatId, orchestrator);
});

// /lopeta <metrixId>
// Stops following a competition. Removes the Orchestrator from the registry
// and marks the competition as finished in the database.
competition.command("lopeta", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.lopetaUsage);

  const chatId = ctx.chat.id;
  const removed = registry.remove(chatId, ctx.match.trim());

  await ctx.reply(removed ? MSG.lopetaOk : MSG.lopetaNotFound);
  if (removed) await competitionService.remove(String(removed.id));
});

// /pelit
// Lists all currently active (followed) competitions in this chat,
// including the number of tracked players and a link to Disc Golf Metrix.
competition.command("pelit", async ctx => {
  const chatId = ctx.chat.id;
  const active = registry.getActive(chatId);

  let message = active.length > 0 ? MSG.pelitHeader : MSG.pelitNone;
  for (const orchestrator of active) {
    message += `${orchestrator.metrixId}: ${orchestrator.snapshot!.Competition.Name}, ${orchestrator.trackedPlayers.length} sankari(a). https://discgolfmetrix.com/${orchestrator.metrixId}\n`;
  }
  await ctx.reply(message, HTML_NO_PREVIEW);
});

// /top5 <metrixId>
// Shows the top 5 players per division for the given competition,
// plus any tracked players ranked outside the top 5 ("Muut Sankarit").
competition.command("top5", async ctx => {
  const chatId = ctx.chat.id;
  const active = registry.getActive(chatId);

  if (!ctx.match) {
    await ctx.reply(active.length > 0 ? MSG.top5Usage : MSG.top5NoneActive);
    return;
  }

  const orchestrator = registry.find(chatId, ctx.match.trim());
  if (orchestrator) {
    orchestrator.sendTopList();
  } else {
    await ctx.reply(MSG.top5NoneActive);
  }
});

// /score <player name>
// Looks up the current score and standings position for a specific player
// in the first active competition being followed in this chat.
competition.command("score", async ctx => {
  const active = registry.getActive(ctx.chat.id);
  const player = ctx.match && active.length > 0
    ? active[0].getScoreByPlayerName(ctx.match.trim())
    : null;

  await ctx.reply(
    player
      ? MSG.scoreFound(player.Name, player.Diff, player.OrderNumber)
      : MSG.scoreNotFound
  );
});
