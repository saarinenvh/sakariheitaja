import { z } from "zod";
import { parseOrThrow } from "../../../../util/validation";
import { HoleScore, Scorecard } from "../../../../integrations/metrix/round/scorecard";
import { optionalIntegerSchema } from "../../../../integrations/metrix/round/scoreSchemas";

const optionalPositiveIntegerSchema = optionalIntegerSchema.refine(value => value === null || value > 0);

const standingSchema = z.object({
  position: optionalPositiveIntegerSchema,
  fieldSize: optionalPositiveIntegerSchema,
  isProvisional: z.boolean().default(true),
}).refine(standing => standing.position === null || standing.fieldSize === null
  || standing.position <= standing.fieldSize);

const roundStateSchema = z.object({
  totalHoles: optionalPositiveIntegerSchema,
  status: z.enum(["unknown", "active", "complete", "dnf"]).default("unknown"),
});

export type Standing = Readonly<z.output<typeof standingSchema>>;
export type RoundState = Readonly<z.output<typeof roundStateSchema>>;

export interface CommentaryScope {
  chatId: number;
  competitionId: string;
  division: string;
  playerId: number;
}

export interface PublishedStanding {
  scope: CommentaryScope;
  standing: Standing;
}

export type StandingMovement =
  | { kind: "unknown" }
  | { kind: "unchanged"; position: number }
  | { kind: "up" | "down"; previousPosition: number; currentPosition: number; places: number };

export type RoundProgress =
  | { kind: "unknown" }
  | { kind: "observed" | "dnf"; completedHoles: number; totalHoles: number | null }
  | { kind: "complete"; completedHoles: number; totalHoles: number };

export interface ScoreCounts {
  underPar: number;
  pars: number;
  overPar: number;
  unknown: number;
}

export interface RoundSummary {
  progress: RoundProgress;
  recordedStrokes: number | null;
  recordedRelativeToPar: number | null;
  scores: ScoreCounts | null;
}

export function parseStanding(input: unknown): Standing {
  return parseOrThrow(standingSchema, input, "commentary standing");
}

export function parseRoundState(input: unknown): RoundState {
  return parseOrThrow(roundStateSchema, input, "commentary round state");
}

export function analyzeRound(scorecard: Scorecard, state: RoundState): RoundSummary {
  if (scorecard.kind === "unavailable") {
    return {
      progress: { kind: "unknown" }, recordedStrokes: null, recordedRelativeToPar: null,
      scores: null,
    };
  }
  const played = scorecard.holes.filter((score): score is HoleScore => score !== null);
  return {
    progress: buildProgress(played.length, scorecard.holes.length, state),
    recordedStrokes: sumKnownScores(played.map(score => score.strokes)),
    recordedRelativeToPar: sumKnownScores(played.map(score => score.relativeToPar)),
    scores: countScores(played),
  };
}

export function comparePublishedStanding(
  scope: CommentaryScope,
  current: Standing,
  lastPublished: PublishedStanding | null,
): StandingMovement {
  if (!lastPublished || !sameCommentaryScope(scope, lastPublished.scope)) return { kind: "unknown" };
  const previous = lastPublished.standing;
  if (current.isProvisional || previous.isProvisional
    || current.position === null || previous.position === null) return { kind: "unknown" };
  if (current.position === previous.position) return { kind: "unchanged", position: current.position };
  return {
    kind: current.position < previous.position ? "up" : "down",
    previousPosition: previous.position,
    currentPosition: current.position,
    places: Math.abs(previous.position - current.position),
  };
}

export function sameCommentaryScope(previous: CommentaryScope, current: CommentaryScope): boolean {
  return previous.chatId === current.chatId
    && previous.competitionId === current.competitionId
    && previous.division === current.division
    && previous.playerId === current.playerId;
}

function buildProgress(completedHoles: number, slots: number, state: RoundState): RoundProgress {
  const totalHoles = state.totalHoles === slots ? state.totalHoles : null;
  if (state.status === "dnf") return { kind: "dnf", completedHoles, totalHoles };
  if (state.status === "complete" && totalHoles !== null && completedHoles === totalHoles) {
    return { kind: "complete", completedHoles, totalHoles };
  }
  return { kind: "observed", completedHoles, totalHoles };
}

function sumKnownScores(values: readonly (number | null)[]): number | null {
  let sum = 0;
  for (const value of values) {
    if (value === null) return null;
    sum += value;
    if (!Number.isSafeInteger(sum)) return null;
  }
  return sum;
}

function countScores(played: readonly HoleScore[]): ScoreCounts {
  const counts = { underPar: 0, pars: 0, overPar: 0, unknown: 0 };
  for (const score of played) {
    if (score.relativeToPar === null) counts.unknown++;
    else if (score.relativeToPar < 0) counts.underPar++;
    else if (score.relativeToPar === 0) counts.pars++;
    else counts.overPar++;
  }
  return counts;
}
