import { CommandContext, Context } from "grammy";
import {
  competitionRepository as competitionRepo,
  registerCompetition,
  ScoreTracker,
  StartResult,
  TrackerDependencies,
  trackerRegistry as registry,
} from "../../../features/live-scoring";
import { liveScoringCommandMessages as MSG } from "./messages";
import { escapeHtml } from "../../../shared/html";
import { METRIX_TIME_ZONE, UnsupportedRoundError } from "../../../integrations/metrix/round/normalize";
import { HTML_NO_PREVIEW } from "../../sendOptions";

type Command = CommandContext<Context>;

/** Starts following a round the chat isn't following yet. The round is taken for the chat until it has started or failed. */
export async function follow(ctx: Command, trackerDependencies: TrackerDependencies): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.followUsage);

  const metrixId = ctx.match.match(/\d+/)?.[0];
  if (!metrixId) return ctx.reply(MSG.followNoNumber);

  const chatId = ctx.chat.id;
  if (!registry.reserve(chatId, metrixId)) return ctx.reply(MSG.followAlready);

  try {
    return await startFollowing(ctx, metrixId, trackerDependencies);
  } finally {
    registry.release(chatId, metrixId);
  }
}

/**
 * Saves the competition and starts its tracker. The registry and the table change before the reply,
 * so a failed reply can't leave a round running that `/lopeta` can't reach, or a row for one that never started.
 */
async function startFollowing(ctx: Command, metrixId: string, trackerDependencies: TrackerDependencies): Promise<unknown> {
  const chatId = ctx.chat.id;
  const { insertId } = await registerCompetition(chatId, ctx.chat.title ?? "", metrixId);
  const tracker = new ScoreTracker(insertId, metrixId, chatId, trackerDependencies);

  const result = await startOrForget(tracker);
  if (result.kind !== "following") {
    await competitionRepo.deleteById(insertId);
    return ctx.reply(formatStartFailure(result));
  }

  registry.add(chatId, tracker);

  return ctx.reply(MSG.followStarted);
}

/** Why `/follow` couldn't start the round: an unsupported round explains itself, the rest get the general answer. */
function formatStartFailure(result: Exclude<StartResult, { kind: "following" }>): string {
  if (result.kind === "no-players") return MSG.followNoPlayers;
  if (result.kind === "invalid" && result.error instanceof UnsupportedRoundError) return result.error.message;

  return MSG.followInvalid;
}

/** A start that throws stops the tracker and deletes its competition before the error goes on. */
async function startOrForget(tracker: ScoreTracker): Promise<StartResult> {
  try {
    return await tracker.start();
  } catch (error) {
    tracker.stopFollowing();
    await competitionRepo.deleteById(tracker.id);
    throw error;
  }
}

/** Deletes the competition first: if that fails, the round goes on as before. */
export async function stopFollowing(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.lopetaUsage);

  const chatId = ctx.chat.id;
  const tracker = registry.findTracked(chatId, ctx.match.trim());
  if (!tracker) return ctx.reply(MSG.lopetaNotFound);

  await competitionRepo.deleteById(tracker.id);
  registry.remove(chatId, tracker);

  return ctx.reply(MSG.lopetaOk);
}

export async function listFollowedRounds(ctx: Command): Promise<unknown> {
  const active = registry.getActive(ctx.chat.id);
  const ongoing = active.filter(tracker => tracker.phase !== "scheduled").map(toFollowedRoundRow);
  const upcoming = active.filter(tracker => tracker.phase === "scheduled").map(toFollowedRoundRow);

  return ctx.reply(formatFollowedRounds(ongoing, upcoming), HTML_NO_PREVIEW);
}

function toFollowedRoundRow(tracker: ScoreTracker): FollowedRoundRow {
  return {
    metrixId: tracker.metrixId,
    name: tracker.snapshot?.name ?? "",
    playerCount: tracker.trackedPlayers.length,
    startsAt: tracker.snapshot?.startsAt ?? null,
  };
}

/** One followed round in `/pelit`. */
export interface FollowedRoundRow {
  metrixId: string;
  name: string;
  playerCount: number;
  startsAt: Date | null;
}

/** `/pelit`: the rounds being played, then the upcoming ones with their start time. */
export function formatFollowedRounds(ongoing: readonly FollowedRoundRow[], upcoming: readonly FollowedRoundRow[]): string {
  if (ongoing.length === 0 && upcoming.length === 0) return MSG.pelitNone;

  const sections: string[] = [];
  if (ongoing.length > 0) sections.push(MSG.pelitHeader + ongoing.map(formatOngoingRound).join("\n"));
  if (upcoming.length > 0) sections.push(MSG.pelitUpcoming + upcoming.map(formatUpcomingRound).join("\n"));

  return sections.join("\n\n");
}

function formatOngoingRound(round: FollowedRoundRow): string {
  return `${round.metrixId}: ${escapeHtml(round.name)}, ${round.playerCount} sankari(a). ${metrixLink(round.metrixId)}`;
}

function formatUpcomingRound(round: FollowedRoundRow): string {
  return `${round.metrixId}: ${escapeHtml(round.name)}, ${formatStartTime(round.startsAt)}, ${round.playerCount} sankari(a). ${metrixLink(round.metrixId)}`;
}

/** In Metrix's own time zone, where the start time comes from. */
function formatStartTime(startsAt: Date | null): string {
  if (!startsAt) return "?";

  return startsAt.toLocaleString("fi-FI", {
    timeZone: METRIX_TIME_ZONE, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function metrixLink(metrixId: string): string {
  return `https://discgolfmetrix.com/${metrixId}`;
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
