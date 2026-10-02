import { Composer } from "grammy";
import { ScoreTracker } from "../../../features/live-scoring/scoreTracker";
import * as competitionService from "../../../features/live-scoring/competitions";
import * as registry from "../../../features/live-scoring/trackerRegistry";
import { competition as MSG } from "../../messages";
import { liveScoringMessages } from "../../../features/live-scoring/messages";
import { HTML_NO_PREVIEW } from "../../sendOptions";
import { trackerDependencies } from "../../dependencies";

export const competition = new Composer();

// /follow <metrixId>
// Starts tracking a disc golf competition from Disc Golf Metrix.
// Saves the competition to the database, creates a ScoreTracker that polls
// for score updates, and announces tracked players in the chat.
competition.command("follow", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.followUsage);

  const metrixId = ctx.match.match(/\d+/)?.[0];
  if (!metrixId) return ctx.reply(MSG.followNoNumber);

  const chatId = ctx.chat.id;
  const result = await competitionService.start(chatId, ctx.chat.title ?? "", metrixId);

  const tracker = await new ScoreTracker(result.insertId, metrixId, chatId, trackerDependencies).init();

  if (!tracker.following) {
    await ctx.reply(tracker.initializationError ?? liveScoringMessages.followInvalid);
    await competitionService.remove(String(result.insertId));
    return;
  }

  await ctx.reply(MSG.followStarted);
  registry.add(chatId, tracker);
});

// /lopeta <metrixId>
// Stops following a competition. Removes the ScoreTracker from the registry
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
  for (const tracker of active) {
    message += `${tracker.metrixId}: ${tracker.snapshot?.name}, ${tracker.trackedPlayers.length} sankari(a). https://discgolfmetrix.com/${tracker.metrixId}\n`;
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

  const tracker = registry.find(chatId, ctx.match.trim());
  if (tracker) {
    await tracker.sendTopList();
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
      ? MSG.scoreFound(player.name, player.totalRelativeToPar, player.standing.position)
      : MSG.scoreNotFound
  );
});
