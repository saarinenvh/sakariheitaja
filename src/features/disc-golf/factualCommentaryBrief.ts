import { compareScorecards, Scorecard, ScorecardComparison, ScoreChange } from "./commentaryFacts";
import {
  analyzeRound, CommentaryScope, comparePublishedStanding, PublishedStanding,
  RoundState, RoundSummary, sameCommentaryScope, Standing, StandingMovement,
} from "./commentaryAnalysis";

export interface CommentarySnapshot {
  scope: CommentaryScope;
  playerName: string;
  courseName: string;
  scorecard: Scorecard;
  round: RoundState;
  standing: Standing;
}

export interface FactualBriefInput {
  previousObserved: CommentarySnapshot;
  current: CommentarySnapshot;
  lastPublished: PublishedStanding | null;
}

export type BriefLimitation = "play-order-unknown";

export interface FactualCommentaryBrief {
  playerName: string;
  courseName: string;
  division: string;
  event: "scores-recorded" | "scores-corrected" | "mixed-update";
  changes: readonly ScoreChange[];
  round: RoundSummary;
  standing: Standing;
  movementSincePublication: StandingMovement;
  limitations: readonly BriefLimitation[];
}

export type FactualBriefResult =
  | { kind: "unavailable"; reason: "scope-changed" | Extract<ScorecardComparison, { kind: "unavailable" }>["reason"] }
  | { kind: "unchanged" }
  | { kind: "ready"; brief: FactualCommentaryBrief };

export function buildFactualCommentaryBrief(input: FactualBriefInput): FactualBriefResult {
  const { previousObserved, current, lastPublished } = input;
  if (!sameCommentaryScope(previousObserved.scope, current.scope)) {
    return { kind: "unavailable", reason: "scope-changed" };
  }
  const comparison = compareScorecards(previousObserved.scorecard, current.scorecard);
  if (comparison.kind === "unavailable") return comparison;
  if (comparison.changes.length === 0) return { kind: "unchanged" };

  return {
    kind: "ready",
    brief: {
      playerName: current.playerName,
      courseName: current.courseName,
      division: current.scope.division,
      event: classifyChanges(comparison.changes),
      changes: comparison.changes,
      round: analyzeRound(current.scorecard, current.round),
      standing: current.standing,
      movementSincePublication: comparePublishedStanding(current.scope, current.standing, lastPublished),
      limitations: buildLimitations(comparison.changes),
    },
  };
}

export function serializeFactualBrief(brief: FactualCommentaryBrief): string {
  return JSON.stringify(brief);
}

function classifyChanges(changes: readonly ScoreChange[]): FactualCommentaryBrief["event"] {
  const hasRecorded = changes.some(change => change.kind === "recorded");
  const hasRevisions = changes.some(change => change.kind !== "recorded");
  if (hasRecorded && hasRevisions) return "mixed-update";
  return hasRecorded ? "scores-recorded" : "scores-corrected";
}

function buildLimitations(changes: readonly ScoreChange[]): FactualCommentaryBrief["limitations"] {
  return changes.length > 0 ? ["play-order-unknown"] : [];
}
