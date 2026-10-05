/**
 * The instant a wall-clock time on a day happens in a time zone, with that day's DST.
 * `day` is `YYYY-MM-DD` and `time` is `HH:MM` or `HH:MM:SS`, both already validated.
 */
export function zonedTimeToInstant(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  const asIfUtc = Date.UTC(year, month - 1, date, hours, minutes, Math.floor(seconds));

  // The zone's offset at the guess can differ from the one at the answer when DST changes in
  // between, so the second pass uses the offset at the first answer.
  const firstGuess = asIfUtc - zoneOffsetMs(new Date(asIfUtc), timeZone);
  const offset = zoneOffsetMs(new Date(firstGuess), timeZone);

  return new Date(asIfUtc - offset);
}

/** How far the zone's wall clock is ahead of UTC at this instant, e.g. 3 h in a Finnish summer. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find(entry => entry.type === type)?.value);

  const wallClockAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));

  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
