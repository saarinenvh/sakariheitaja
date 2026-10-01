import { analyzeRound } from "./roundAnalysis";
import { MetrixRound, RoundPlayer } from "../../metrix/metrixRound";

export interface DivisionStanding {
  playerName: string;
  position: number | null;
  provisional: boolean;
  dnf: boolean;
  recordedHoles: number | null;
  roundRelativeToPar: number | null;
  leaderGap: LeaderGap;
}

export type LeaderGap =
  | { kind: "leader" }
  | { kind: "behind"; strokes: number }
  | { kind: "not-compared" }
  | { kind: "no-leader" };

/** One division's standings in place order (players without a place last), so list order never contradicts position. */
export function buildDivisionStandings(round: MetrixRound, division: string): DivisionStanding[] {
  const players = round.players.filter(player => player.division === division).sort(compareByPosition);
  const leader = players.find(player => player.standing.position === 1 && player.round.status !== "dnf") ?? null;
  return players.map(player => {
    const summary = analyzeRound(player.scorecard, player.round);
    const recordedHoles = summary.progress.kind === "unknown" ? null : summary.progress.completedHoles;
    return {
      playerName: player.name, position: player.standing.position,
      provisional: player.standing.isProvisional, dnf: player.round.status === "dnf",
      recordedHoles, roundRelativeToPar: recordedHoles ? summary.recordedRelativeToPar : null,
      leaderGap: compareToLeader(leader, player),
    };
  });
}

function compareByPosition(first: RoundPlayer, second: RoundPlayer): number {
  return (first.standing.position ?? Number.POSITIVE_INFINITY) - (second.standing.position ?? Number.POSITIVE_INFINITY);
}

type TotalComparison =
  | { kind: "compared"; difference: number }
  | { kind: "excluded" }
  | { kind: "not-comparable" }
  | { kind: "unknown" };

function compareToLeader(leader: RoundPlayer | null, player: RoundPlayer): LeaderGap {
  if (leader === null) return { kind: "no-leader" };
  if (player.standing.position === 1) return { kind: "leader" };
  const comparison = compareRecordedTotals(leader, player);
  return comparison.kind === "compared" ? { kind: "behind", strokes: comparison.difference } : { kind: "not-compared" };
}

/** Positive `difference` means the opponent is behind the subject. */
function compareRecordedTotals(subject: RoundPlayer, opponent: RoundPlayer): TotalComparison {
  if (subject.round.status === "dnf" || opponent.round.status === "dnf"
    || subject.standing.isProvisional || opponent.standing.isProvisional) return { kind: "excluded" };
  const subjectCard = subject.scorecard;
  const opponentCard = opponent.scorecard;
  if (subjectCard.kind !== "available" || opponentCard.kind !== "available"
    || subjectCard.holes.length !== opponentCard.holes.length
    || !subjectCard.holes.some(hole => hole !== null)
    || !subjectCard.holes.every((hole, index) => (hole === null) === (opponentCard.holes[index] === null))) {
    return { kind: "not-comparable" };
  }
  const subjectTotal = analyzeRound(subjectCard, subject.round).recordedRelativeToPar;
  const opponentTotal = analyzeRound(opponentCard, opponent.round).recordedRelativeToPar;
  if (subjectTotal === null || opponentTotal === null) return { kind: "unknown" };
  const difference = opponentTotal - subjectTotal;
  if (!Number.isSafeInteger(difference)) return { kind: "unknown" };
  return { kind: "compared", difference };
}
