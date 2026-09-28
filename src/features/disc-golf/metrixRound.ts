import { z } from "zod";
import { parseOrThrow } from "../../util/validation";
import { MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";
import { integerSchema, optionalIntegerSchema } from "./scoreSchemas";
import { parseScorecard, Scorecard } from "./commentaryFacts";
import { analyzeRound, parseRoundState, parseStanding, RoundState, Standing } from "./commentaryAnalysis";
import { CommentarySnapshot } from "./factualCommentaryBrief";

const positiveInteger = integerSchema.pipe(z.number().int().positive());
const identifier = positiveInteger.transform(String);
const optionalText = z.string().nullish().transform(value => value ?? "");
// Metrix reports tied players, and many players early in a round, with place 0.
const METRIX_UNRANKED = 0;
const dnfSchema = z.union([
  z.literal("1"), z.literal(1), z.literal(true), z.literal("DNF"),
  z.literal("0"), z.literal(0), z.literal(false), z.literal(""),
]).nullish().transform(value => value === "1" || value === 1 || value === true || value === "DNF");

const trackSchema = z.object({
  Number: positiveInteger,
  NumberAlt: optionalText,
  Par: optionalIntegerSchema.refine(value => value === null || value > 0),
});
const playerSchema = z.object({
  UserID: optionalIntegerSchema.refine(value => value === null || value >= 0),
  Name: z.string().trim().min(1),
  ClassName: optionalText,
  Group: optionalText,
  DNF: dnfSchema,
  Sum: optionalIntegerSchema,
  Diff: optionalIntegerSchema,
  OrderNumber: optionalIntegerSchema.refine(value => value === null || value >= 0),
  PreviousRoundsSum: optionalIntegerSchema,
  PreviousRoundsDiff: optionalIntegerSchema,
  PlayerResults: z.unknown().transform(parseScorecard),
});
const roundSchema = z.object({
  Competition: z.object({
    ID: identifier,
    Name: z.string(),
    Date: z.string(),
    CourseName: z.string(),
    Tracks: z.array(trackSchema),
    SubCompetitions: z.array(z.unknown()).nullish(),
    HasSubcompetitions: optionalIntegerSchema,
    Results: z.array(playerSchema),
    ShowPreviousRoundsSum: optionalIntegerSchema,
  }),
  Errors: z.array(z.string()).nullish().refine(errors => !errors?.length),
});

export interface RoundPlayer {
  sourceId: number | null;
  name: string;
  division: string;
  group: string;
  scorecard: Scorecard;
  round: RoundState;
  standing: Standing;
  totalStrokes: number | null;
  totalRelativeToPar: number | null;
}

export interface MetrixRound {
  id: string;
  name: string;
  date: string;
  courseName: string;
  layoutKey: string;
  holeLabels: readonly string[];
  players: readonly RoundPlayer[];
}

export interface TrackedRoundPlayer {
  id: number;
  player: RoundPlayer;
}

export interface RoundBagtagPlayer {
  Name: string;
  Diff: number | null;
  Group: string;
  DNF: string | null;
}

interface FinalTotals {
  strokes: number | null;
  relativeToPar: number | null;
}

export class UnsupportedRoundError extends Error {
  constructor() {
    super("Seuranta tukee vain yksittäisiä kierroksia. Anna kierroksen oma Metrix-ID, ei monikierroskisan tai sarjan ID:tä.");
  }
}

export function parseMetrixRound(input: unknown, expectedId: string): MetrixRound {
  const { Competition: source } = parseOrThrow(roundSchema, input, "Metrix round");
  if (source.ID !== expectedId) throw new Error("Metrix returned a different round ID");
  if (source.Tracks.length === 0 || source.SubCompetitions?.length
    || (source.HasSubcompetitions ?? 0) !== 0) throw new UnsupportedRoundError();
  const holeLabels = source.Tracks.map(track => track.NumberAlt || String(track.Number));
  if (new Set(holeLabels).size !== holeLabels.length) throw new Error("Metrix returned duplicate hole labels");
  const tiedPositions = rankByRecordedTotals(source.Results);
  const players = source.Results.map((player, index) => normalizePlayer(player, source, tiedPositions[index]));
  return {
    id: source.ID, name: source.Name, date: source.Date, courseName: source.CourseName,
    layoutKey: JSON.stringify([source.CourseName, source.Tracks]), holeLabels, players,
  };
}

export function trackRoundPlayers(round: MetrixRound, tracked: readonly { id: number; name: string }[]): TrackedRoundPlayer[] {
  const result: TrackedRoundPlayer[] = [];
  for (const identity of tracked) {
    const matching = round.players.filter(player => player.name === identity.name);
    if (matching.length === 1) result.push({ id: identity.id, player: matching[0] });
  }
  return result;
}

export function buildCommentarySnapshot(round: MetrixRound, tracked: TrackedRoundPlayer, chatId: number): CommentarySnapshot {
  const { id, player } = tracked;
  return {
    scope: { chatId, competitionId: round.id, division: player.division, playerId: id },
    playerName: player.name, courseName: round.courseName, holeLabels: round.holeLabels,
    scorecard: player.scorecard, round: player.round, standing: player.standing,
  };
}

export function hasTrackedRoundEnded(players: readonly TrackedRoundPlayer[]): boolean {
  return players.length > 0 && players.every(({ player }) => {
    if (player.round.status === "dnf") return true;
    const card = player.scorecard;
    const totals = finalTotals(player);
    return card.kind === "available" && card.holes.length === player.round.totalHoles
      && card.holes.every(hole => hole !== null) && totals.strokes !== null && totals.relativeToPar !== null;
  });
}

export function toLegacyResults(players: readonly RoundPlayer[]): MetrixPlayerResult[] {
  const results: MetrixPlayerResult[] = [];
  for (const player of players) {
    if (player.totalStrokes === null || player.totalRelativeToPar === null
      || player.standing.position === null || player.standing.isProvisional) continue;
    results.push({
      Name: player.name, ClassName: player.division, Group: player.group || undefined,
      Sum: player.totalStrokes, Diff: player.totalRelativeToPar, OrderNumber: player.standing.position,
      DNF: player.round.status === "dnf" ? "1" : null,
    });
  }
  return results;
}

export function toLegacyTracked(players: readonly TrackedRoundPlayer[]): TrackedPlayer[] {
  return players.flatMap(tracked => toLegacyResults([tracked.player]).map(player => ({ ...player, id: tracked.id })));
}

export function toFinalScores(players: readonly TrackedRoundPlayer[]): { id: number; Diff: number; Sum: number }[] {
  return players.flatMap(({ id, player }) => {
    const totals = finalTotals(player);
    if (player.round.status === "dnf" || totals.strokes === null || totals.relativeToPar === null) return [];
    return [{ id, Sum: totals.strokes, Diff: totals.relativeToPar }];
  });
}

export function toBagtagPlayers(players: readonly TrackedRoundPlayer[]): RoundBagtagPlayer[] {
  return players.map(({ player }) => ({
    Name: player.name, Diff: finalTotals(player).relativeToPar, Group: player.group || "1",
    DNF: player.round.status === "dnf" ? "1" : null,
  }));
}

function finalTotals(player: RoundPlayer): FinalTotals {
  const card = player.scorecard;
  const complete = card.kind === "available" && card.holes.length === player.round.totalHoles
    && card.holes.every(hole => hole !== null);
  const recorded = complete ? analyzeRound(card, player.round) : null;
  return {
    strokes: player.totalStrokes ?? recorded?.recordedStrokes ?? null,
    relativeToPar: player.totalRelativeToPar ?? recorded?.recordedRelativeToPar ?? null,
  };
}

function normalizePlayer(
  source: z.output<typeof playerSchema>,
  competition: z.output<typeof roundSchema>["Competition"],
  rankedPosition: number | null,
): RoundPlayer {
  const fieldSize = competition.Results.filter(player => player.ClassName === source.ClassName).length;
  let scorecard = source.PlayerResults;
  if (scorecard.kind === "available" && scorecard.holes.length !== competition.Tracks.length) {
    scorecard = { kind: "unavailable" };
  }
  const round = parseRoundState({ totalHoles: competition.Tracks.length, status: source.DNF ? "dnf" : "active" });
  const aggregateStanding = (competition.ShowPreviousRoundsSum ?? 0) !== 0
    || source.PreviousRoundsSum !== null || source.PreviousRoundsDiff !== null;
  const position = resolvePosition(source, fieldSize, rankedPosition, aggregateStanding);
  return {
    sourceId: source.UserID || null, name: source.Name, division: source.ClassName, group: source.Group,
    scorecard, round,
    standing: parseStanding({ position, fieldSize, isProvisional: position === null || aggregateStanding }),
    totalStrokes: source.Sum, totalRelativeToPar: source.Diff,
  };
}

function resolvePosition(
  source: z.output<typeof playerSchema>, fieldSize: number, rankedPosition: number | null, aggregateStanding: boolean,
): number | null {
  if (source.DNF || source.OrderNumber === null || source.OrderNumber > fieldSize) return null;
  if (source.OrderNumber === METRIX_UNRANKED) return aggregateStanding ? null : rankedPosition;
  return source.OrderNumber;
}

/** Shared competition places (ties share a place) from recorded scorecard totals, per division. */
function rankByRecordedTotals(results: readonly z.output<typeof playerSchema>[]): (number | null)[] {
  const totals = results.map(player => player.DNF ? null : recordedRelativeToPar(player.PlayerResults));
  return results.map((player, index) => {
    const total = totals[index];
    if (total === null) return null;
    let betterPlayers = 0;
    results.forEach((other, otherIndex) => {
      const otherTotal = totals[otherIndex];
      if (other.ClassName === player.ClassName && otherTotal !== null && otherTotal < total) betterPlayers++;
    });
    return betterPlayers + 1;
  });
}

function recordedRelativeToPar(scorecard: Scorecard): number | null {
  if (scorecard.kind !== "available") return null;
  let total = 0;
  let recordedHoles = 0;
  for (const hole of scorecard.holes) {
    if (hole === null) continue;
    if (hole.relativeToPar === null) return null;
    total += hole.relativeToPar;
    recordedHoles++;
  }
  return recordedHoles > 0 ? total : null;
}
