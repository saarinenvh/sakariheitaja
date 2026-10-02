import { HoleScore } from "../../../../integrations/metrix/round/types";
import { ScoreChange } from "../detect/scorecardChanges";
import { FactualCommentaryBrief } from "../facts/playerBrief";

/** Plain factual text for one player, used when the model is off, fails or replies unusably. */
export function buildFactualFallback(brief: FactualCommentaryBrief): string {
  const opening = getFallbackOpening(brief);
  const changes = `${brief.playerName}: ${brief.changes.map(describeChange).join(" ")}`;
  const standing = describeStanding(brief);
  const round = describeRound(brief);
  return [opening, changes, standing, round].filter(Boolean).join(" ");
}

function getFallbackOpening(brief: FactualCommentaryBrief): string {
  const recordedOpenings = ["No niin, kortille tuli uusi tulos.", "Kas, tulos kirjattiin korttiin.", "Ja sieltä tuli uusi merkintä."];
  const correctionOpenings = ["Korttiin tuli korjaus.", "Pieni tarkistus tuloskorttiin.", "Tulosmerkintä päivittyi."];
  const mixedOpenings = ["Kortilla päivittyy nyt useampi kohta.", "Tuloksia tuli ja yksi merkintä meni uusiksi.", "Tuloskortissa tapahtuu useammalla väylällä."];
  const openings = brief.event === "scores-recorded" ? recordedOpenings
    : brief.event === "scores-corrected" ? correctionOpenings
    : mixedOpenings;
  const variation = brief.changes.reduce((sum, change) => sum + change.holeNumber, 0);
  return openings[variation % openings.length];
}

function describeChange(change: ScoreChange): string {
  if (change.kind === "recorded") {
    return `Väylä ${change.holeLabel ?? change.holeNumber}: ${describeScore(change.score)}.`;
  }
  if (change.kind === "corrected") {
    return `Väylän ${change.holeLabel ?? change.holeNumber} tulos muuttui: ${describeScore(change.previous)} vaihtui tulokseen ${describeScore(change.current)}.`;
  }
  return `Väylän ${change.holeLabel ?? change.holeNumber} tulosmerkintä poistettiin. Aiempi merkintä oli ${describeScore(change.previous)}.`;
}

function describeScore(score: HoleScore): string {
  const relativeToPar = score.relativeToPar;
  const label = score.strokes === 1 ? "ässä" : relativeToPar === null ? "tulos"
    : relativeToPar <= -3 ? `${Math.abs(relativeToPar)} alle parin`
    : relativeToPar === -2 ? "eagle"
    : relativeToPar === -1 ? "birdie"
    : relativeToPar === 0 ? "par"
    : relativeToPar === 1 ? "bogi"
    : relativeToPar === 2 ? "tuplabogi"
    : `${relativeToPar} yli parin`;
  const outOfBounds = score.obCount === null ? ", OB-määrä tuntematon"
    : score.obCount === 0 ? ", ei OB-merkintöjä"
    : score.obCount === 1 ? ", 1 OB"
    : `, ${score.obCount} OB-merkintää`;
  const relation = relativeToPar === null ? "ero väylän pariin tuntematon"
    : relativeToPar === 0 ? "väylän par-tulos"
    : `${Math.abs(relativeToPar)} ${relativeToPar < 0 ? "alle" : "yli"} väylän parin`;
  return `${label} (${score.strokes} heittoa, ${relation}${outOfBounds})`;
}

function describeStanding(brief: FactualCommentaryBrief): string {
  const { standing, movementSincePublication } = brief;
  if (standing.position === null) return "";
  const currentPlace = standing.isProvisional ? `alustavasti sijalla ${standing.position}`
    : `sijalla ${standing.position}`;
  if (movementSincePublication.kind === "up") {
    return `Nyt ${currentPlace}, nousua ${movementSincePublication.places} sijaa viime julkaisusta.`;
  }
  if (movementSincePublication.kind === "down") {
    return `Nyt ${currentPlace}, pudotusta ${movementSincePublication.places} sijaa viime julkaisusta.`;
  }
  if (movementSincePublication.kind === "unchanged") return `Sijoitus pysyy: ${currentPlace}.`;
  return `Tämänhetkinen sijoitus: ${currentPlace}.`;
}

function describeRound(brief: FactualCommentaryBrief): string {
  const { progress } = brief.round;
  if (progress.kind === "unknown") return "";
  if (progress.kind === "complete") return `Kierros valmis: ${progress.completedHoles}/${progress.totalHoles} väylää kirjattu.`;
  if (progress.kind === "dnf") return `Kierros päättyi keskeytykseen ${progress.completedHoles} kirjatun väylän jälkeen.`;
  if (progress.totalHoles === null) return `${progress.completedHoles} väylältä on tulos.`;
  return `${progress.completedHoles}/${progress.totalHoles} väylältä on tulos.`;
}
