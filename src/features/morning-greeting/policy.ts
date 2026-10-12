import { addDays, dayInTimeZone, zonedTimeToInstant } from "../../shared/time";

/** The greeting goes out at this wall-clock time in Helsinki, whatever the container's time zone. */
export const GREETING_TIME = "09:00";
export const GREETING_TIME_ZONE = "Europe/Helsinki";

/** How long until the next greeting: today's 09:00 in Helsinki if it's still ahead, else tomorrow's, with that day's DST. */
export function msUntilNextGreeting(now: Date): number {
  const today = dayInTimeZone(now, GREETING_TIME_ZONE);
  const todays = zonedTimeToInstant(today, GREETING_TIME, GREETING_TIME_ZONE);
  const next = todays > now ? todays : zonedTimeToInstant(addDays(today, 1), GREETING_TIME, GREETING_TIME_ZONE);

  return next.getTime() - now.getTime();
}
