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

function describeGap(subject: RoundPlayer, opponent: RoundPlayer): string {
  if (subject === opponent) return "Kommentoitava pelaaja itse.";
  if (subject.round.status === "dnf" || opponent.round.status === "dnf"
    || subject.standing.isProvisional || opponent.standing.isProvisional) return "Eroa ei verrata.";
  const subjectCard = subject.scorecard;
  const opponentCard = opponent.scorecard;
  if (subjectCard.kind !== "available" || opponentCard.kind !== "available"
    || subjectCard.holes.length !== opponentCard.holes.length
    || !subjectCard.holes.some(hole => hole !== null)
    || !subjectCard.holes.every((hole, index) => (hole === null) === (opponentCard.holes[index] === null))) {
    return "Eroa ei verrata: samojen väylien tulokset eivät ole käytettävissä.";
  }
  const subjectTotal = analyzeRound(subjectCard, subject.round).recordedRelativeToPar;
  const opponentTotal = analyzeRound(opponentCard, opponent.round).recordedRelativeToPar;
  if (subjectTotal === null || opponentTotal === null) return "Eroa ei tiedetä.";
  const difference = opponentTotal - subjectTotal;
  if (!Number.isSafeInteger(difference)) return "Eroa ei tiedetä.";
  if (difference === 0) return `Sama kirjattu yhteistulos kuin pelaajalla ${subject.name}.`;
  const direction = difference < 0 ? "edellä" : "jäljessä";
  return `${Math.abs(difference)} heittoa ${direction} pelaajaa ${subject.name} samoilla kirjatuilla väylillä.`;
}
