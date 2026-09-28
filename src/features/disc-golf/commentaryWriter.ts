import { z } from "zod";
import { OllamaMessage } from "../../shared/llm/ollamaClient";
import { FactualCommentaryBrief } from "./factualCommentaryBrief";
import { HoleScore, ScoreChange } from "./commentaryFacts";
import { CompetitionPlayerFact } from "./competitionFacts";
import { buildSpokenNames } from "./spokenNames";

const modelResponseSchema = z.string().trim().min(1);
const responseLeakMarkers = ["Pelaaja:", "Reaktiovihjeitä:", "Tulosnimivaihtoehtoja:", "Kirjoita vain"];

export type CommentaryModel = (messages: OllamaMessage[]) => Promise<unknown>;

export interface CommentaryPromptContext {
  factualBrief: FactualCommentaryBrief;
  narrativeHistory: readonly string[];
  competitionFacts?: readonly CompetitionPlayerFact[];
}

export type CommentaryText =
  | { kind: "generated"; text: string }
  | { kind: "fallback"; text: string; reason: "generation-failed" | "unusable-response" | "disabled" };

export async function writeFactualCommentary(
  context: CommentaryPromptContext,
  systemPrompt: string,
  generate: CommentaryModel,
): Promise<CommentaryText> {
  const spokenNames = buildContextSpokenNames(context);
  const spokenPlayerName = spokenNames.get(context.factualBrief.playerName) ?? context.factualBrief.playerName;
  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: serializeCommentaryContext(context, spokenNames) },
  ];

  try {
    const response = await generate(messages);
    const result = modelResponseSchema.safeParse(response);
    if (!result.success) {
      return { kind: "fallback", text: buildFactualFallback(context.factualBrief), reason: "unusable-response" };
    }
    if (containsPromptLeak(result.data) || !mentionsPlayer(result.data, spokenPlayerName)) {
      return { kind: "fallback", text: buildFactualFallback(context.factualBrief), reason: "unusable-response" };
    }
    return { kind: "generated", text: result.data };
  } catch {
    return { kind: "fallback", text: buildFactualFallback(context.factualBrief), reason: "generation-failed" };
  }
}

function serializeCommentaryContext(context: CommentaryPromptContext, spokenNames: ReadonlyMap<string, string>): string {
  const brief = context.factualBrief;
  const speak = (fullName: string): string => spokenNames.get(fullName) ?? fullName;
  return JSON.stringify({
    factualBrief: {
      playerName: speak(brief.playerName),
      events: brief.changes.map(describeChange),
      recordedRoundTotal: describeRelativeTotal(brief.round.recordedRelativeToPar),
      progress: describeRound(brief),
      standing: describeStanding(brief) || "Sijoitus tuntematon.",
      movement: brief.movementSincePublication.kind === "unknown" ? "Sijoituksen muutosta ei tiedetä." : describeStanding(brief),
      playOrder: "Väylänumero ei osoita pelaamisjärjestystä. Heittokuvailu on sallittua koomista väritystä, ei tulosfakta.",
    },
    competitionFacts: (context.competitionFacts ?? []).map(fact => ({ ...fact, playerName: speak(fact.playerName) })),
    narrativeHistory: context.narrativeHistory,
  });
}

function buildContextSpokenNames(context: CommentaryPromptContext): ReadonlyMap<string, string> {
  const competitorNames = (context.competitionFacts ?? []).map(fact => fact.playerName);
  return buildSpokenNames([context.factualBrief.playerName, ...competitorNames]);
}

function describeRelativeTotal(total: number | null): string {
  if (total === null) return "Kirjattujen väylien yhteistulos suhteessa pariin tuntematon.";
  if (total === 0) return "Kirjattujen väylien yhteistulos: par (0).";
  return `Kirjattujen väylien yhteistulos: ${total > 0 ? "+" : ""}${total}, ${Math.abs(total)} ${total < 0 ? "alle" : "yli"} parin.`;
}

export function buildFactualFallback(brief: FactualCommentaryBrief): string {
  const opening = getFallbackOpening(brief);
  const changes = `${brief.playerName}: ${brief.changes.map(describeChange).join(" ")}`;
  const standing = describeStanding(brief);
  const round = describeRound(brief);
  return [opening, changes, standing, round].filter(Boolean).join(" ");
}

function containsPromptLeak(text: string): boolean {
  return responseLeakMarkers.some(marker => text.includes(marker));
}

function mentionsPlayer(text: string, playerName: string): boolean {
  return text.toLocaleLowerCase("fi").includes(playerName.toLocaleLowerCase("fi"));
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
