import { FactualCommentaryBrief } from "./factualCommentaryBrief";
import { HoleScore, ScoreChange } from "./commentaryFacts";

export const TELEGRAM_MESSAGE_LIMIT = 4096;

export interface CommentaryPost {
  brief: FactualCommentaryBrief;
  text: string;
}

export interface CommentaryMessage<Post extends CommentaryPost> {
  html: string;
  published: { post: Post; text: string; firstFragment: boolean }[];
}

export function formatCommentaryMessages<Post extends CommentaryPost>(
  posts: readonly Post[], metrixId: string, opening: string,
): CommentaryMessage<Post>[] {
  const messages: CommentaryMessage<Post>[] = [];
  let message: CommentaryMessage<Post> = { html: escapeHtml(opening), published: [] };
  let previousHeading = "";
  for (const post of posts) {
    const heading = formatHeading(post.brief, metrixId);
    const footer = formatFooter(post.brief);
    const available = TELEGRAM_MESSAGE_LIMIT - escapeHtml(opening).length - heading.length - footer.length - 8;
    if (available <= 0) throw new Error("Commentary metadata exceeds Telegram message limit");
    const fragments = splitEscapedText(post.text, available);
    for (const [index, fragment] of fragments.entries()) {
      let block = `${heading === previousHeading ? "" : `\n\n${heading}`}\n\n${fragment.html}\n${footer}`;
      if (message.html.length + block.length > TELEGRAM_MESSAGE_LIMIT) {
        messages.push(message);
        message = { html: escapeHtml(opening), published: [] };
        block = `\n\n${heading}\n\n${fragment.html}\n${footer}`;
      }
      message.html += block;
      previousHeading = heading;
      message.published.push({ post, text: fragment.text, firstFragment: index === 0 });
    }
  }
  if (posts.length > 0) messages.push(message);
  return messages;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatHeading(brief: FactualCommentaryBrief, metrixId: string): string {
  const labels = brief.changes.map(change => change.holeLabel ?? String(change.holeNumber));
  const label = labels.length === 1 ? `Väylä ${labels[0]}` : `Väylät ${labels.join(", ")}`;
  const course = brief.courseName.replace(/&rarr;/g, "");
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
  if (change.kind === "removed") return `poistettu (${scoreLabel(change.previous)})`;
  if (change.kind === "corrected") return `korjaus: ${scoreLabel(change.previous)} → ${scoreLabel(change.current)}`;
  return scoreLabel(change.score);
}

function scoreLabel(score: HoleScore): string {
  const labels = new Map([[0, "par"], [-1, "birdie"], [-2, "eagle"], [1, "bogi"], [2, "tuplabogi"]]);
  let label = `${score.strokes} heittoa`;
  if (score.strokes === 1) label = "ässä";
  else if (score.relativeToPar !== null) label = labels.get(score.relativeToPar) ?? signed(score.relativeToPar);
  if (score.obCount !== null && score.obCount > 0) label += ` (${score.obCount} OB)`;
  return label;
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
