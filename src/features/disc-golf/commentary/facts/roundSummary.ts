import { HoleScore, RoundState, Scorecard } from "../../../../integrations/metrix/round/types";

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
