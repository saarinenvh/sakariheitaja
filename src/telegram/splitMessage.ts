import { TELEGRAM_MESSAGE_LIMIT } from "../features/chatMessenger";

export type TextFormat = "plain" | "html";

interface OpenTag {
  name: string;
  /** The opening tag as written, attributes included, so a later part can reopen it. */
  opening: string;
}

const ELLIPSIS = "…";
/** A tag ends at its first `>`: Telegram wants it escaped inside attribute values. */
const HTML_TAG = /<(\/?)([a-zA-Z-]+)[^>]*>/g;
/** A tag, an entity, or one whole character: the pieces an HTML line can be cut between. */
const HTML_TOKEN = /<[^>]*>|&#?\w+;|[\s\S]/gu;

/**
 * Splits a message into as few parts as fit `maxLength`, in order, between lines. In HTML, the tags
 * open at a split are closed at the end of the part and reopened at the start of the next, so a
 * `<code>` table continues as one. A line too long on its own is cut short and ends with "…". A part
 * never starts with a blank line, because Telegram refuses a message with nothing to show.
 * Lengths are UTF-16 units of the raw text, never less strict than Telegram's count.
 */
export function splitMessage(text: string, format: TextFormat, maxLength: number = TELEGRAM_MESSAGE_LIMIT): string[] {
  // Below 1 not even the "…" fits, and cutting a line would never end.
  if (!Number.isInteger(maxLength) || maxLength < 1) throw new RangeError("maxLength must be a positive integer");
  if (text.length <= maxLength || !hasVisibleText(text, format)) return [text];

  const parts: string[] = [];
  let part: string | null = null;
  let openTags: OpenTag[] = [];

  for (const line of text.split("\n")) {
    const openAfterLine = trackTags(openTags, line, format);
    const joined: string | null = part === null ? null : `${part}\n${line}`;

    if (joined !== null && fits(joined, openAfterLine, maxLength)) {
      part = joined;
      openTags = openAfterLine;
      continue;
    }

    if (part !== null) parts.push(part + closingTags(openTags));
    part = null;

    if (hasVisibleText(line, format)) {
      const started = openingTags(openTags) + line;
      if (fits(started, openAfterLine, maxLength)) part = started;
      else parts.push(cutLine(line, openTags, format, maxLength));
    }

    openTags = openAfterLine;
  }

  if (part !== null) parts.push(part + closingTags(openTags));

  return parts;
}

function fits(part: string, openTags: readonly OpenTag[], maxLength: number): boolean {
  return part.length + closingTags(openTags).length <= maxLength;
}

/** A part of its own for a line too long for any part: as much of it as fits, never cut inside a tag or entity. */
function cutLine(line: string, openTags: readonly OpenTag[], format: TextFormat, maxLength: number): string {
  const opening = openingTags(openTags);
  const tokens = tokenize(line, format);
  let keptLength = line.length;

  while (tokens.length > 0) {
    if (opening.length + keptLength + ELLIPSIS.length <= maxLength) {
      const kept = tokens.join("");
      const cut = opening + kept + ELLIPSIS + closingTags(trackTags(openTags, kept, format));
      if (cut.length <= maxLength) return cut;
    }

    keptLength -= tokens.pop()?.length ?? 0;
  }

  const tagged = opening + ELLIPSIS + closingTags(openTags);

  return tagged.length <= maxLength ? tagged : ELLIPSIS;
}

function hasVisibleText(text: string, format: TextFormat): boolean {
  const visible = format === "html" ? text.replace(HTML_TAG, "") : text;

  return visible.trim() !== "";
}

function tokenize(line: string, format: TextFormat): string[] {
  if (format === "plain") return [...line];

  return line.match(HTML_TOKEN) ?? [];
}

/** The tags open after `text`, given those open before it. Plain text has none. */
function trackTags(openTags: readonly OpenTag[], text: string, format: TextFormat): OpenTag[] {
  const open = [...openTags];
  if (format === "plain") return open;

  for (const [tag, slash, name] of text.matchAll(HTML_TAG)) {
    const tagName = name.toLowerCase();

    if (slash === "") {
      open.push({ name: tagName, opening: tag });
      continue;
    }

    const index = open.map(openTag => openTag.name).lastIndexOf(tagName);
    if (index !== -1) open.splice(index, 1);
  }

  return open;
}

function openingTags(openTags: readonly OpenTag[]): string {
  return openTags.map(tag => tag.opening).join("");
}

function closingTags(openTags: readonly OpenTag[]): string {
  return openTags.map(tag => `</${tag.name}>`).reverse().join("");
}
