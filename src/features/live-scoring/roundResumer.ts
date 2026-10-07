import { ScoreTracker, StartResult } from "./liveScoring";
import { errorBackoffMs, hasResumeTimedOut } from "./policy";
import * as competitionRepo from "./db/competitionRepository";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("live-scoring");

const UNAVAILABLE_REASON = "Metrix didn't answer within the resume time limit";
const NO_PLAYERS_REASON = "no tracked players in the round";

/** The part of a `ScoreTracker` resuming uses. */
export type ResumableRound = Pick<ScoreTracker, "id" | "metrixId" | "stopped" | "start" | "stopFollowing">;

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

function wait(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/** If marking it fails, the competition stays `following` and the next restart tries again. */
async function giveUp(tracker: ResumableRound, reason: string): Promise<void> {
  tracker.stopFollowing();
  await competitionRepo.markError(tracker.id, reason, new Date());
}
