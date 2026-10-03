import { CommandContext, Context } from "grammy";
import { registerCompetition, ScoreTracker, TrackerDependencies } from "../../../features/live-scoring/liveScoring";
import * as competitionRepo from "../../../features/live-scoring/db/competitionRepository";
import * as registry from "../../../features/live-scoring/trackerRegistry";
import { liveScoringMessages } from "../../../features/live-scoring/messages";
import { liveScoringCommandMessages as MSG } from "./messages";
import { HTML_NO_PREVIEW } from "../../sendOptions";

type Command = CommandContext<Context>;

/** Saves the competition, starts a tracker and keeps it in the chat's registry if it could start. */
export async function follow(ctx: Command, trackerDependencies: TrackerDependencies): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.followUsage);

  const metrixId = ctx.match.match(/\d+/)?.[0];
  if (!metrixId) return ctx.reply(MSG.followNoNumber);

  const chatId = ctx.chat.id;
  const result = await registerCompetition(chatId, ctx.chat.title ?? "", metrixId);

  const tracker = await new ScoreTracker(result.insertId, metrixId, chatId, trackerDependencies).init();

  if (!tracker.following) {
    await ctx.reply(tracker.initializationError ?? liveScoringMessages.followInvalid);
    await competitionRepo.deleteById(result.insertId);
    return;
  }

  await ctx.reply(MSG.followStarted);
  registry.add(chatId, tracker);
}

export async function stopFollowing(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.lopetaUsage);

  const chatId = ctx.chat.id;
  const removed = registry.remove(chatId, ctx.match.trim());

  await ctx.reply(removed ? MSG.lopetaOk : MSG.lopetaNotFound);
  if (removed) await competitionRepo.deleteById(removed.id);
}

export async function listFollowedRounds(ctx: Command): Promise<unknown> {
  const active = registry.getActive(ctx.chat.id);

  let message = active.length > 0 ? MSG.pelitHeader : MSG.pelitNone;
  for (const tracker of active) {
    message += `${tracker.metrixId}: ${tracker.snapshot?.name}, ${tracker.trackedPlayers.length} sankari(a). https://discgolfmetrix.com/${tracker.metrixId}\n`;
  }
  return ctx.reply(message, HTML_NO_PREVIEW);
}

export async function showTopList(ctx: Command): Promise<unknown> {
  const chatId = ctx.chat.id;
  const active = registry.getActive(chatId);

  if (!ctx.match) return ctx.reply(active.length > 0 ? MSG.top5Usage : MSG.top5NoneActive);

  const tracker = registry.find(chatId, ctx.match.trim());
  if (!tracker) return ctx.reply(MSG.top5NoneActive);
  await tracker.sendTopList();
}

/** The player's score in the first round the chat follows. */
export async function showPlayerScore(ctx: Command): Promise<unknown> {
  const active = registry.getActive(ctx.chat.id);
  const player = ctx.match && active.length > 0
    ? active[0].getScoreByPlayerName(ctx.match.trim())
    : null;

  return ctx.reply(
    player
      ? MSG.scoreFound(player.name, player.totalRelativeToPar, player.standing.position)
      : MSG.scoreNotFound,
  );
}
