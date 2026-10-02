import { z } from "zod";
import { OllamaMessage } from "../../../../shared/llm/ollamaClient";
import { BatchCommentaryContext } from "./commentaryContext";
import { RoundProgress, StandingMovement } from "../facts/roundAnalysis";
import { ScoreChange } from "../detect/scorecardChanges";
import { holeScoreName } from "../presentation";
import { buildFactualFallback } from "./factualFallback";
import { LeaderGap } from "../facts/standings";
import { FactualCommentaryBrief } from "../facts/playerBrief";
import { selectCommentaryRating } from "../facts/courseFacts";

export interface BatchCommentaryLine {
  brief: FactualCommentaryBrief;
  text: string;
}

export interface BatchCommentary {
  opening: string;
  lines: readonly BatchCommentaryLine[];
  closing: string;
}

export type BatchCommentaryResult =
  | { kind: "generated"; commentary: BatchCommentary }
  | { kind: "fallback"; commentary: BatchCommentary; reason: "generation-failed" | "unusable-response" | "disabled" };

export type StructuredCommentaryModel = (messages: OllamaMessage[], jsonSchema: Record<string, unknown>) => Promise<unknown>;

/**
 * Ollama constrains generation to this schema, so the model can only name the update's players,
 * spelled exactly as given, and must write one line for each of them.
 */
export function buildBatchResponseJsonSchema(playerNames: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      opening: { type: "string" },
      players: {
        type: "array",
        minItems: playerNames.length,
        maxItems: playerNames.length,
        items: {
          type: "object",
          properties: { name: { type: "string", enum: [...playerNames] }, text: { type: "string" } },
          required: ["name", "text"],
        },
      },
      closing: { type: "string" },
    },
    required: ["opening", "players", "closing"],
  };
}

// Only a label that starts a line or a sentence: stripping from mid-sentence would cut the sentence short.
const RESULT_LABEL_PATTERN = /(^|[.!?][ \t]+|\n)[ \t]*tulo(?:s|kset|sta)[ \t]*:[^\n.!?]*[.!?]?/gimu;

const nonEmptyText = z.string().trim().min(1);
const batchResponseSchema = z.object({
  opening: nonEmptyText,
  players: z.array(z.object({ name: nonEmptyText, text: nonEmptyText })),
  closing: nonEmptyText,
});
type BatchResponse = z.output<typeof batchResponseSchema>;

export async function writeBatchCommentary(
  context: BatchCommentaryContext,
  systemPrompt: string,
  generate: StructuredCommentaryModel,
): Promise<BatchCommentaryResult> {
  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: serializeBatchContext(context) },
  ];
  let reply: unknown;
  try {
    reply = await generate(messages, buildBatchResponseJsonSchema(spokenPlayerNames(context)));
  } catch {
    return { kind: "fallback", commentary: buildBatchFallback(context), reason: "generation-failed" };
  }
  const response = parseBatchResponse(reply);
  const lines = response ? matchPlayerLines(context, response) : null;
  if (!response || !lines) {
    return { kind: "fallback", commentary: buildBatchFallback(context), reason: "unusable-response" };
  }
  return { kind: "generated", commentary: { opening: response.opening, lines, closing: response.closing } };
}

export function buildBatchFallback(context: Pick<BatchCommentaryContext, "players">): BatchCommentary {
  return { opening: "", lines: context.players.map(brief => ({ brief, text: buildFactualFallback(brief) })), closing: "" };
}

function serializeBatchContext(context: BatchCommentaryContext): string {
  const speak = (fullName: string): string => context.spokenNames.get(fullName) ?? fullName;
  return JSON.stringify({
    firstMessage: context.firstMessage,
    hole: describeUpdatedHoles(context.players),
    players: context.players.map(brief => ({
      name: speak(brief.playerName),
      holes: brief.changes.map(describeChange),
      roundTotal: brief.round.recordedRelativeToPar,
      progress: describeProgress(brief.round.progress),
      position: brief.standing.position,
      provisional: brief.standing.isProvisional,
      positionChange: describeMovement(brief.movementSincePublication),
      roundRating: selectCommentaryRating(context.roundRatings.get(brief.playerName)),
    })),
    standings: context.standings.map(standing => ({
      name: speak(standing.playerName),
      position: standing.position,
      recordedHoles: standing.recordedHoles,
      roundTotal: standing.roundRelativeToPar,
      behindLeader: describeLeaderGap(standing.leaderGap),
      dnf: standing.dnf,
      provisional: standing.provisional,
    })),
    scorecard: context.scorecardTable,
    playOrder: context.playOrderKnown ? "väylänumerojärjestys" : "tuntematon",
    leadHistory: context.leadHistory,
    holeFacts: context.holeFacts,
    course: context.courseDifficulty,
    weather: context.weather,
    recentMessages: context.recentMessages,
  });
}

function parseBatchResponse(reply: unknown): BatchResponse | null {
  if (typeof reply !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(reply);
  } catch {
    return null;
  }
  const result = batchResponseSchema.safeParse(json);
  return result.success ? result.data : null;
}

function matchPlayerLines(context: BatchCommentaryContext, response: BatchResponse): BatchCommentaryLine[] | null {
  if (response.players.length !== context.players.length) return null;
  const lines: BatchCommentaryLine[] = [];
  for (const brief of context.players) {
    const spokenName = normalizeName(context.spokenNames.get(brief.playerName) ?? brief.playerName);
    const matches = response.players.filter(player => normalizeName(player.name) === spokenName);
    if (matches.length !== 1) return null;
    const text = stripResultLabels(matches[0].text);
    if (!text) return null;
    lines.push({ brief, text });
  }
  return lines;
}

/** The model tends to append "Tulos: birdie." although the result row is rendered separately. */
function stripResultLabels(text: string): string {
  return text.replace(RESULT_LABEL_PATTERN, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function spokenPlayerNames(context: BatchCommentaryContext): string[] {
  return context.players.map(brief => context.spokenNames.get(brief.playerName) ?? brief.playerName);
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("fi");
}

function describeUpdatedHoles(briefs: readonly FactualCommentaryBrief[]): string {
  const labels = briefs.flatMap(brief => brief.changes.map(change => change.holeLabel ?? String(change.holeNumber)));
  return [...new Set(labels)].join(", ");
}

function describeChange(change: ScoreChange): Record<string, string | number | null> {
  const hole = change.holeLabel ?? String(change.holeNumber);
  if (change.kind === "corrected") {
    return { hole, correction: `${holeScoreName(change.previous)} → ${holeScoreName(change.current)}` };
  }
  if (change.kind === "removed") return { hole, removed: holeScoreName(change.previous) };
  return { hole, result: holeScoreName(change.score), ob: change.score.obCount };
}

function describeProgress(progress: RoundProgress): string {
  if (progress.kind === "unknown") return "tuntematon";
  if (progress.kind === "complete") return "valmis";
  if (progress.kind === "dnf") return "keskeytetty";
  return progress.totalHoles === null ? `${progress.completedHoles} väylää` : `${progress.completedHoles}/${progress.totalHoles}`;
}

function describeMovement(movement: StandingMovement): string {
  if (movement.kind === "unknown") return "ei tiedossa";
  if (movement.kind === "unchanged") return "ennallaan";
  return movement.kind === "up" ? `nousu ${movement.places}` : `pudotus ${movement.places}`;
}

function describeLeaderGap(gap: LeaderGap): string | number {
  if (gap.kind === "leader") return "kärjessä";
  if (gap.kind === "behind") return gap.strokes;
  return gap.kind === "not-compared" ? "ei vertailukelpoinen" : "ei tiedossa";
}
