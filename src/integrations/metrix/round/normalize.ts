import { z } from "zod";
import { parseOrThrow } from "../../../util/validation";
import { optionalIntegerSchema, RawCompetition, RawPlayer, roundSchema, scorecardSchema } from "./rawSchema";
import { MetrixRound, RoundPlayer, RoundState, Scorecard, Standing } from "./types";

// Metrix reports tied players, and many players early in a round, with place 0 or no place at all.
const METRIX_UNRANKED = 0;

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

interface ParsedPlayer {
  source: RawPlayer;
  scorecard: Scorecard;
}

export class UnsupportedRoundError extends Error {
  constructor() {
    super("Seuranta tukee vain yksittäisiä kierroksia. Anna kierroksen oma Metrix-ID, ei monikierroskisan tai sarjan ID:tä.");
  }
}

/**
 * Validates and normalizes one round's `api.php?content=result` payload.
 * Throws `ValidationError` for a payload it can't trust, and `UnsupportedRoundError` for an event or series.
 */
export function parseMetrixRound(input: unknown, expectedId: string): MetrixRound {
  const { Competition: source } = parseOrThrow(roundSchema, input, "Metrix round");
  if (source.ID !== expectedId) throw new Error("Metrix returned a different round ID");
  if (source.Tracks.length === 0 || source.SubCompetitions?.length
    || (source.HasSubcompetitions ?? 0) !== 0) throw new UnsupportedRoundError();
  const holeLabels = source.Tracks.map(track => track.NumberAlt || String(track.Number));
  if (new Set(holeLabels).size !== holeLabels.length) throw new Error("Metrix returned duplicate hole labels");
  const parsed = source.Results.map(player => ({ source: player, scorecard: parseScorecard(player.PlayerResults) }));
  const tiedPositions = rankByRecordedTotals(parsed);
  const players = parsed.map((player, index) => normalizePlayer(player, source, tiedPositions[index]));
  return {
    id: source.ID, name: source.Name, date: source.Date, courseName: source.CourseName,
    courseId: source.CourseID, layoutKey: JSON.stringify([source.CourseName, source.Tracks]), holeLabels, players,
  };
}

/** A player's `PlayerResults`; throws `ValidationError` ("Metrix PlayerResults") for a malformed card. */
export function parseScorecard(input: unknown): Scorecard {
  const holes = parseOrThrow(scorecardSchema, input, "Metrix PlayerResults");
  if (!holes || holes.length === 0) return { kind: "unavailable" };
  return { kind: "available", holes };
}

/** A standing from loose values (numeric strings allowed); the place must fit the field. */
export function parseStanding(input: unknown): Standing {
  return parseOrThrow(standingSchema, input, "Metrix standing");
}

export function parseRoundState(input: unknown): RoundState {
  return parseOrThrow(roundStateSchema, input, "Metrix round state");
}

function normalizePlayer({ source, scorecard: parsedCard }: ParsedPlayer, competition: RawCompetition, rankedPosition: number | null): RoundPlayer {
  const fieldSize = competition.Results.filter(player => player.ClassName === source.ClassName).length;
  const scorecard: Scorecard = parsedCard.kind === "available" && parsedCard.holes.length !== competition.Tracks.length
    ? { kind: "unavailable" } : parsedCard;
  const round = parseRoundState({ totalHoles: competition.Tracks.length, status: resolveRoundStatus(source.DNF, scorecard) });
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

/** Metrix has no completion flag, so a full card without DNF counts as a complete round. */
function resolveRoundStatus(dnf: boolean, scorecard: Scorecard): RoundState["status"] {
  if (dnf) return "dnf";
  const fullCard = scorecard.kind === "available" && scorecard.holes.length > 0 && scorecard.holes.every(hole => hole !== null);
  return fullCard ? "complete" : "active";
}

function resolvePosition(source: RawPlayer, fieldSize: number, rankedPosition: number | null, aggregateStanding: boolean): number | null {
  if (source.DNF || (source.OrderNumber !== null && source.OrderNumber > fieldSize)) return null;
  if (source.OrderNumber === null || source.OrderNumber === METRIX_UNRANKED) return aggregateStanding ? null : rankedPosition;
  return source.OrderNumber;
}

/** Shared competition places (ties share a place) from recorded scorecard totals, per division. */
function rankByRecordedTotals(players: readonly ParsedPlayer[]): (number | null)[] {
  const totals = players.map(({ source, scorecard }) => source.DNF ? null : recordedRelativeToPar(scorecard));
  return players.map(({ source }, index) => {
    const total = totals[index];
    if (total === null) return null;
    let betterPlayers = 0;
    players.forEach((other, otherIndex) => {
      const otherTotal = totals[otherIndex];
      if (other.source.ClassName === source.ClassName && otherTotal !== null && otherTotal < total) betterPlayers++;
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
