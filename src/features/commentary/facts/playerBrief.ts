import { ScoreChange } from "../detect/scorecardChanges";
import { Scorecard } from "../../../integrations/metrix/round/types";
import { analyzeRound, RoundSummary } from "./roundSummary";
import { CommentaryScope, comparePublishedStanding, PublishedStanding, StandingMovement } from "../detect/standingMovement";
import { RoundState, Standing } from "../../../integrations/metrix/round/types";

export interface CommentarySnapshot {
  scope: CommentaryScope;
  playerName: string;
  courseName: string;
  holeLabels?: readonly string[];
  scorecard: Scorecard;
  round: RoundState;
  standing: Standing;
}

export interface FactualBriefInput {
  current: CommentarySnapshot;
  changes: readonly ScoreChange[];
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

/** A player's update as facts. `changes` are the non-empty changes detected since the previous observation. */
export function buildFactualCommentaryBrief(input: FactualBriefInput): FactualCommentaryBrief {
  const { current, changes, lastPublished } = input;
  return {
    playerName: current.playerName,
    courseName: current.courseName,
    division: current.scope.division,
    event: classifyChanges(changes),
    changes: changes.map(change => ({
      ...change, holeLabel: current.holeLabels?.[change.holeNumber - 1] ?? String(change.holeNumber),
    })),
    round: analyzeRound(current.scorecard, current.round),
    standing: current.standing,
    movementSincePublication: comparePublishedStanding(current.scope, current.standing, lastPublished),
    limitations: buildLimitations(changes),
  };
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
