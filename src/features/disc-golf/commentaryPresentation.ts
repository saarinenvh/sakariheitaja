import { FactualCommentaryBrief } from "./factualCommentaryBrief";
import { HoleScore, ScoreChange } from "./commentaryFacts";

export const TELEGRAM_MESSAGE_LIMIT = 4096;
const BLOCK_SEPARATOR = "\n\n";
const OPENING_PREFIX = "🎙️ ";
const CLOSING_PREFIX = "📊 ";
const ITALIC_MARKUP_LENGTH = "<i></i>".length;
const HOLE_SCORE_NAMES = new Map([[0, "par"], [-1, "birdie"], [-2, "eagle"], [1, "bogi"], [2, "tuplabogi"]]);

export interface CommentaryPost {
  brief: FactualCommentaryBrief;
  text: string;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface BatchCommentaryMessage<Post extends CommentaryPost> {
  html: string;
  posts: Post[];
}

interface MessageBlock<Post> {
  html: string;
  post: Post | null;
}

/** One Telegram message per batch: heading, opening, each player's line with its result row, closing. */
export function formatBatchCommentaryMessages<Post extends CommentaryPost>(
  opening: string, posts: readonly Post[], closing: string, metrixId: string,
): BatchCommentaryMessage<Post>[] {
  if (posts.length === 0) return [];
  const labels = [...new Set(posts.flatMap(post => post.brief.changes.map(change => change.holeLabel ?? String(change.holeNumber))))];
  const heading = formatHoleHeading(labels, posts[0].brief.courseName, metrixId);
  const blocks = buildBatchBlocks(opening, posts, closing, TELEGRAM_MESSAGE_LIMIT - heading.length - BLOCK_SEPARATOR.length);
  const messages: BatchCommentaryMessage<Post>[] = [];
  let message: BatchCommentaryMessage<Post> = { html: heading, posts: [] };
  for (const block of blocks) {
    if (message.html.length + BLOCK_SEPARATOR.length + block.html.length > TELEGRAM_MESSAGE_LIMIT) {
      messages.push(message);
      message = { html: heading, posts: [] };
    }
    message.html += `${BLOCK_SEPARATOR}${block.html}`;
    if (block.post) message.posts.push(block.post);
  }
  messages.push(message);
  return messages;
}

function buildBatchBlocks<Post extends CommentaryPost>(
  opening: string, posts: readonly Post[], closing: string, maxBlockLength: number,
): MessageBlock<Post>[] {
  const blocks: MessageBlock<Post>[] = [];
  if (opening.trim()) {
    for (const fragment of splitEscapedText(opening, maxBlockLength - OPENING_PREFIX.length - ITALIC_MARKUP_LENGTH)) {
      blocks.push({ html: `${OPENING_PREFIX}<i>${fragment.html}</i>`, post: null });
    }
  }
  for (const post of posts) {
    const footer = formatFooter(post.brief);
    const fragments = splitEscapedText(post.text, maxBlockLength - footer.length - 1);
    fragments.forEach((fragment, index) => {
      const isLast = index === fragments.length - 1;
      blocks.push({ html: isLast ? `${fragment.html}\n${footer}` : fragment.html, post: isLast ? post : null });
    });
  }
  if (closing.trim()) {
    for (const fragment of splitEscapedText(closing, maxBlockLength - CLOSING_PREFIX.length)) {
      blocks.push({ html: `${CLOSING_PREFIX}${fragment.html}`, post: null });
    }
  }
  return blocks;
}

function formatHoleHeading(labels: readonly string[], courseName: string, metrixId: string): string {
  const label = labels.length === 1 ? `Väylä ${labels[0]}` : `Väylät ${labels.join(", ")}`;
  const course = courseName.replace(/&rarr;/g, "");
  const shortCourse = course.length > 38 ? `${course.slice(0, 37)}...` : course;
  return `⛳ ${escapeHtml(label)} · <a href="https://discgolfmetrix.com/${encodeURIComponent(metrixId)}">${escapeHtml(shortCourse)}</a>`;
}

function formatFooter(brief: FactualCommentaryBrief): string {
  const changes = brief.changes.map(change => {
    const result = describeChange(change);
    return brief.changes.length === 1 ? result : `${change.holeLabel ?? change.holeNumber}: ${result}`;
  }).join("; ");
  const total = brief.round.recordedRelativeToPar;
  const standing = brief.standing.position === null ? "sija ?" : `sija ${brief.standing.position}`;
  const qualifier = brief.standing.isProvisional && brief.standing.position !== null ? " (alustava)" : "";
  const movement = brief.movementSincePublication;
  const arrow = movement.kind === "up" ? " ↑" : movement.kind === "down" ? " ↓" : "";
  return `<blockquote>${escapeHtml(`${changes} | ${brief.playerName} | ${total === null ? "?" : signed(total)} | ${standing}${qualifier}${arrow}`)}</blockquote>`;
}

function describeChange(change: ScoreChange): string {
  if (change.kind === "removed") return `poistettu (${formatHoleScore(change.previous)})`;
  if (change.kind === "corrected") return `korjaus: ${formatHoleScore(change.previous)} → ${formatHoleScore(change.current)}`;
  return formatHoleScore(change.score);
}

/** Result name with OB count, as shown in footers and the scorecard table. */
export function formatHoleScore(score: HoleScore): string {
  const label = holeScoreName(score);
  return score.obCount !== null && score.obCount > 0 ? `${label} (${score.obCount} OB)` : label;
}

export function holeScoreName(score: HoleScore): string {
  if (score.strokes === 1) return "ässä";
  if (score.relativeToPar === null) return `${score.strokes} heittoa`;
  return HOLE_SCORE_NAMES.get(score.relativeToPar) ?? signed(score.relativeToPar);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

interface TextFragment {
  text: string;
  html: string;
}

function splitEscapedText(text: string, limit: number): TextFragment[] {
  const parts: TextFragment[] = [];
  let part: TextFragment = { text: "", html: "" };
  for (const character of text) {
    const escaped = escapeHtml(character);
    if (part.html.length + escaped.length > limit) {
      if (!part.text) throw new Error("Commentary fragment cannot fit Telegram message");
      parts.push(part);
      part = { text: "", html: "" };
    }
    part.text += character;
    part.html += escaped;
  }
  if (part.text) parts.push(part);
  return parts;
}
