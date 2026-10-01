import { BatchCommentaryContext } from "../../src/features/disc-golf/batchCommentaryContext";
import { BatchCommentaryResult } from "../../src/features/disc-golf/batchCommentaryWriter";
import { FactualCommentaryBrief } from "../../src/features/disc-golf/factualCommentaryBrief";

export type CheckSeverity = "fail" | "warn" | "info";

export const CHECK_DESCRIPTIONS = {
  "fallback": "Model reply unusable or failed; factual fallback published",
  "result-label": "Model wrote a \"Tulos:\" label (stripped before publishing)",
  "golf-verb": "Ball-golf verb (lyönti/lyödä) instead of heitto",
  "false-ob": "Player line mentions OB/outti although the hole had no OB",
  "water-imagery": "Player line uses lake/water imagery although the hole had no OB",
  "unsupported-movement": "Player line claims rising/falling although movement is unknown or unchanged",
  "wrong-hole": "Opening or closing names a hole number other than this update's",
  "sentence-limit": "Opening, player line or closing exceeds its sentence limit",
  "comparison-count": "More than one \"kuin\" comparison across the player lines",
  "name-missing": "Player line does not mention the player's name",
} as const;

export type CheckId = keyof typeof CHECK_DESCRIPTIONS;

export interface CheckFinding {
  check: CheckId;
  severity: CheckSeverity;
  detail: string;
}

export interface CheckedBatch {
  context: BatchCommentaryContext;
  result: BatchCommentaryResult;
  rawReply: string | null;
}

const OPENING_MAX_SENTENCES = 2;
const LINE_MAX_SENTENCES = 2;
const CLOSING_MAX_SENTENCES = 2;
const MAX_COMPARISONS_PER_MESSAGE = 1;

const RESULT_LABEL = /(?:^|\s)tulo(?:s|kset|sta)\s*:/iu;
const GOLF_VERB = /\blyö(?:n|d|m)\p{L}*/iu;
const OB_WORD = /\b(?:ob|outti\p{L}*|out of bounds)\b/iu;
const WATER_WORD = /järve\p{L}*|\bjärvi\p{L}*|veteen|vedessä|lammik\p{L}*|uimakoulu\p{L}*|sukel\p{L}*/iu;
const MOVEMENT_WORD = /\b(?:nous\p{L}*|nouse\p{L}*|kiipe\p{L}*|johtoon|putos\p{L}*|putoa\p{L}*|tippu\p{L}*|karkas\p{L}*)/iu;
const HOLE_NUMBER = /(\d{1,2})\.?\s*väyl|väyl\p{L}*\s+(\d{1,2})\b/giu;
const COMPARISON = /\bkuin\b/giu;

export function runChecks(batch: CheckedBatch): CheckFinding[] {
  if (batch.result.kind === "fallback") {
    return [{ check: "fallback", severity: "fail", detail: batch.result.reason }];
  }
  const { opening, lines, closing } = batch.result.commentary;
  const findings: CheckFinding[] = [];
  if (batch.rawReply && RESULT_LABEL.test(batch.rawReply)) {
    findings.push({ check: "result-label", severity: "warn", detail: "present in the raw reply" });
  }
  const allText = [opening, ...lines.map(line => line.text), closing].join("\n");
  if (GOLF_VERB.test(allText)) findings.push({ check: "golf-verb", severity: "fail", detail: matchOf(GOLF_VERB, allText) });
  findings.push(...checkSentenceLimit("opening", opening, OPENING_MAX_SENTENCES));
  findings.push(...checkSentenceLimit("closing", closing, CLOSING_MAX_SENTENCES));
  findings.push(...checkHoleNumbers(batch.context, opening, closing));
  for (const line of lines) findings.push(...checkPlayerLine(batch.context, line.brief, line.text));
  const comparisons = lines.reduce((count, line) => count + (line.text.match(COMPARISON)?.length ?? 0), 0);
  if (comparisons > MAX_COMPARISONS_PER_MESSAGE) {
    findings.push({ check: "comparison-count", severity: "warn", detail: `${comparisons} comparisons` });
  }
  return findings;
}

export function countSentences(text: string): number {
  return text.trim().split(/(?<=[.!?…])\s+/u).filter(part => /\p{L}/u.test(part)).length;
}

function checkPlayerLine(context: BatchCommentaryContext, brief: FactualCommentaryBrief, text: string): CheckFinding[] {
  const name = context.spokenNames.get(brief.playerName) ?? brief.playerName;
  const findings: CheckFinding[] = [...checkSentenceLimit(`line for ${name}`, text, LINE_MAX_SENTENCES)];
  const hadOb = brief.changes.some(change => change.kind === "recorded" && (change.score.obCount ?? 0) > 0);
  if (!hadOb && OB_WORD.test(text)) findings.push({ check: "false-ob", severity: "fail", detail: `${name}: "${matchOf(OB_WORD, text)}"` });
  if (!hadOb && WATER_WORD.test(text)) findings.push({ check: "water-imagery", severity: "warn", detail: `${name}: "${matchOf(WATER_WORD, text)}"` });
  const movement = brief.movementSincePublication.kind;
  if ((movement === "unknown" || movement === "unchanged") && MOVEMENT_WORD.test(text)) {
    findings.push({ check: "unsupported-movement", severity: "warn", detail: `${name} (${movement}): "${matchOf(MOVEMENT_WORD, text)}"` });
  }
  const firstName = name.split(/\s+/)[0].toLocaleLowerCase("fi");
  if (!text.toLocaleLowerCase("fi").includes(firstName)) findings.push({ check: "name-missing", severity: "info", detail: name });
  return findings;
}

function checkSentenceLimit(part: string, text: string, limit: number): CheckFinding[] {
  const sentences = countSentences(text);
  return sentences > limit ? [{ check: "sentence-limit", severity: "warn", detail: `${part}: ${sentences} sentences` }] : [];
}

function checkHoleNumbers(context: BatchCommentaryContext, opening: string, closing: string): CheckFinding[] {
  const holes = new Set(context.players.flatMap(brief => brief.changes.map(change => change.holeLabel ?? String(change.holeNumber))));
  const findings: CheckFinding[] = [];
  for (const [part, text] of [["opening", opening], ["closing", closing]] as const) {
    for (const match of text.matchAll(HOLE_NUMBER)) {
      const number = match[1] ?? match[2];
      if (!holes.has(number)) findings.push({ check: "wrong-hole", severity: "fail", detail: `${part} says ${number}, update is ${[...holes].join(", ")}` });
    }
  }
  return findings;
}

function matchOf(pattern: RegExp, text: string): string {
  return text.match(new RegExp(pattern.source, pattern.flags.replace("g", "")))?.[0] ?? "";
}
