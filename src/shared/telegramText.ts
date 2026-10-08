/** Telegram refuses a message longer than this. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

const ELLIPSIS = "…";

/**
 * Packs lines, in order and joined with newlines, into as few messages as fit `maxLength`. A line is
 * never split across messages; one too long on its own is cut short and ends with "…".
 */
export function packLines(lines: readonly string[], maxLength: number = TELEGRAM_MESSAGE_LIMIT): string[] {
  // Below 1 not even the "…" fits, and cutting a line would never end.
  if (!Number.isInteger(maxLength) || maxLength < 1) throw new RangeError("maxLength must be a positive integer");

  const messages: string[] = [];
  let current: string | null = null;

  for (const line of lines.map(line => fitLine(line, maxLength))) {
    const joined: string = current === null ? line : `${current}\n${line}`;
    if (joined.length <= maxLength) {
      current = joined;
      continue;
    }

    if (current !== null) messages.push(current);
    current = line;
  }

  if (current !== null) messages.push(current);

  return messages;
}

/** Cuts on whole characters, so an emoji is never left half. Lengths are UTF-16 units, as strict as Telegram's count. */
function fitLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) return line;

  const characters = [...line];
  while (characters.join("").length + ELLIPSIS.length > maxLength) characters.pop();

  return characters.join("") + ELLIPSIS;
}
