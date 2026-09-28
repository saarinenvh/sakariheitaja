import { analyzeRound } from "./commentaryAnalysis";
import { MetrixRound, RoundPlayer } from "./metrixRound";

export interface CompetitionPlayerFact {
  playerName: string;
  position: number | null;
  provisional: boolean;
  dnf: boolean;
  recordedHoles: number | null;
  roundRelativeToPar: number | null;
  comparisonToPlayer: string;
}

export function buildCompetitionFacts(round: MetrixRound, subject: RoundPlayer): CompetitionPlayerFact[] {
  return round.players.filter(player => player.division === subject.division).map(player => {
    const summary = analyzeRound(player.scorecard, player.round);
    const recordedHoles = summary.progress.kind === "unknown" ? null : summary.progress.completedHoles;
    return {
      playerName: player.name, position: player.standing.position,
      provisional: player.standing.isProvisional, dnf: player.round.status === "dnf",
      recordedHoles, roundRelativeToPar: recordedHoles ? summary.recordedRelativeToPar : null,
      comparisonToPlayer: describeGap(subject, player),
    };
  });
}

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

export function buildDivisionStandings(round: MetrixRound, division: string): DivisionStanding[] {
  const players = round.players.filter(player => player.division === division);
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

type TotalComparison =
  | { kind: "compared"; difference: number }
  | { kind: "excluded" }
  | { kind: "not-comparable" }
  | { kind: "unknown" };

function describeGap(subject: RoundPlayer, opponent: RoundPlayer): string {
  if (subject === opponent) return "Kommentoitava pelaaja itse.";
  const comparison = compareRecordedTotals(subject, opponent);
  if (comparison.kind !== "compared") return describeMissingComparison(comparison);
  if (comparison.difference === 0) return "Sama kirjattu yhteistulos kuin kommentoitavalla pelaajalla.";
  const direction = comparison.difference < 0 ? "edellä" : "jäljessä";
  return `${Math.abs(comparison.difference)} heittoa ${direction} kommentoitavaa pelaajaa samoilla kirjatuilla väylillä.`;
}

function compareToLeader(leader: RoundPlayer | null, player: RoundPlayer): LeaderGap {
  if (leader === null) return { kind: "no-leader" };
  if (player.standing.position === 1) return { kind: "leader" };
  const comparison = compareRecordedTotals(leader, player);
  return comparison.kind === "compared" ? { kind: "behind", strokes: comparison.difference } : { kind: "not-compared" };
}

function describeMissingComparison(comparison: Exclude<TotalComparison, { kind: "compared" }>): string {
  if (comparison.kind === "excluded") return "Eroa ei verrata.";
  if (comparison.kind === "not-comparable") return "Eroa ei verrata: samojen väylien tulokset eivät ole käytettävissä.";
  return "Eroa ei tiedetä.";
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
