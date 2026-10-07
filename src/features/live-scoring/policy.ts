import type { AppConfig } from "../../config";

/** The configured poll intervals; each is the interval before jitter. */
export type PollIntervals = AppConfig["polling"];

const IDLE_AFTER_QUIET_POLLS = 3;
const DORMANT_AFTER_QUIET_POLLS = 10;
const ERROR_BACKOFF_BASE_MS = 60_000;
const ERROR_BACKOFF_MAX_MS = 600_000;
const JITTER_FRACTION = 0.15;
const RESUME_GIVE_UP_AFTER_MS = 6 * 60 * 60 * 1000;

/** The next interval after an answered poll: active while scores change, then idle, then dormant as quiet polls add up. */
export function quietPollIntervalMs(intervals: PollIntervals, quietPolls: number): number {
  if (quietPolls < IDLE_AFTER_QUIET_POLLS) return intervals.activeIntervalMs;
  if (quietPolls < DORMANT_AFTER_QUIET_POLLS) return intervals.idleIntervalMs;
  return intervals.dormantIntervalMs;
}

/** The next interval after failed polls: doubles with each consecutive failure (counted from 1), up to a maximum. */
export function errorBackoffMs(consecutiveErrors: number): number {
  return Math.min(ERROR_BACKOFF_BASE_MS * Math.pow(2, consecutiveErrors - 1), ERROR_BACKOFF_MAX_MS);
}

/** Whether a resumed round has failed to start for too long, counted from its first attempt. */
export function hasResumeTimedOut(firstAttemptAt: Date, now: Date): boolean {
  return now.getTime() - firstAttemptAt.getTime() >= RESUME_GIVE_UP_AFTER_MS;
}

/** Spreads an interval evenly around its value by `JITTER_FRACTION`, so polls do not fall into step; `random` is in [0, 1). */
export function withJitter(intervalMs: number, random: number): number {
  return Math.floor(intervalMs * (1 + (random * 2 * JITTER_FRACTION - JITTER_FRACTION)));
}

/** How long to wait before the first poll: until the round starts, or none once it has (or without a start). */
export function msUntilStart(startsAt: Date | null, now: Date): number {
  if (startsAt === null) return 0;

  return Math.max(0, startsAt.getTime() - now.getTime());
}
