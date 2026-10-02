export function getRandom(i: number): number {
  return Math.floor(Math.random() * i);
}

/** "9:05" in the server's local time. */
export function formatClockTime(date: Date): string {
  const minutes = "0" + date.getMinutes();
  return date.getHours() + ":" + minutes.slice(-2);
}
