import { ScoreTracker, StartResult, TrackerDependencies } from "./liveScoring";
import * as registry from "./trackerRegistry";
import { errorBackoffMs, hasResumeTimedOut } from "./policy";
import * as competitionRepo from "./db/competitionRepository";
import { moduleLogger } from "../../shared/logger";
import { wait } from "../../shared/time";

const log = moduleLogger("live-scoring");

const UNAVAILABLE_REASON = "Metrix didn't answer within the resume time limit";
const NO_PLAYERS_REASON = "no tracked players in the round";

/** The part of a `ScoreTracker` resuming uses. */
export type ResumableRound = Pick<ScoreTracker, "id" | "metrixId" | "stopped" | "start" | "stopFollowing">;

/**
 * Resumes every competition the last run was following, without a new player announcement. Each
 * starts in the background, in the registry from the start so `/lopeta` can stop it. A second row
 * for a round the chat already follows is marked as an error instead, so no round is followed twice.
 */
export async function resumeFollowedRounds(dependencies: TrackerDependencies): Promise<void> {
  for (const competition of await competitionRepo.findFollowing()) {
    const { id, chatId, metrixId } = competition;

    const original = registry.findTracked(chatId, metrixId);
    if (original) {
      await markDuplicate(id, original.id);
      continue;
    }

    const tracker = new ScoreTracker(id, metrixId, chatId, dependencies, true);
    registry.add(chatId, tracker);
    resumeRound(tracker).catch(err => log.error({ metrixId, err }, "could not resume or give up on the round"));
  }
}

/** A failure is logged: the duplicate stays `following` and is caught again at the next restart. */
async function markDuplicate(id: number, originalId: number): Promise<void> {
  try {
    await competitionRepo.markError(id, `duplicate of competition ${originalId}`, new Date());
  } catch (error) {
    log.error({ competitionId: id, err: error }, "could not mark a duplicate competition");
  }
}

/**
 * Starts a round the last run was following. While Metrix doesn't answer it retries, backing off
 * like a failed poll; after the time limit (`policy.ts`), or at once for a round Metrix rejects,
 * the round is given up on: it stops and its competition is marked as an error. Stopping it with
 * `/lopeta` ends the retries.
 */
export async function resumeRound(tracker: ResumableRound): Promise<void> {
  const firstAttemptAt = new Date();

  for (let attempt = 1; ; attempt++) {
    const result = await attemptStart(tracker);
    if (result.kind !== "unavailable") return settleStart(tracker, result);

    if (hasResumeTimedOut(firstAttemptAt, new Date())) return giveUp(tracker, UNAVAILABLE_REASON);

    log.warn({ metrixId: tracker.metrixId, attempt }, "resumed round couldn't start, retrying");
    await wait(errorBackoffMs(attempt));
    if (tracker.stopped) return;
  }
}

/** A start that throws (the database, say) is retried like an unanswered Metrix request. */
async function attemptStart(tracker: ResumableRound): Promise<StartResult> {
  try {
    return await tracker.start();
  } catch (error) {
    log.error({ metrixId: tracker.metrixId, err: error }, "resumed round failed to start");
    return { kind: "unavailable" };
  }
}

async function settleStart(tracker: ResumableRound, result: Exclude<StartResult, { kind: "unavailable" }>): Promise<void> {
  switch (result.kind) {
    case "following":
    case "stopped":
      return;
    case "invalid":
      return giveUp(tracker, String(result.error));
    case "no-players":
      return giveUp(tracker, NO_PLAYERS_REASON);
  }
}

/** If marking it fails, the competition stays `following` and the next restart tries again. */
async function giveUp(tracker: ResumableRound, reason: string): Promise<void> {
  tracker.stopFollowing();
  await competitionRepo.markError(tracker.id, reason, new Date());
}
