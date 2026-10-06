import { MetrixRound, RoundPlayer, Scorecard, TrackedRoundPlayer } from "./types";

// Questions the bot asks of a normalized round: whose players are these, has the round ended, what were the results.

/** A player's final totals: Metrix's own when it has them, else summed from a complete card. */
export interface FinalTotals {
  strokes: number | null;
  relativeToPar: number | null;
}

/** A player Metrix has placed in their division with known totals: the shape of a results list. */
export interface RankedResult {
  playerName: string;
  division: string;
  position: number;
  strokes: number;
  relativeToPar: number;
}

export interface TrackedRankedResult extends RankedResult {
  playerId: number;
}

/** A finished, non-DNF round's totals for saving. */
export interface FinalScore {
  playerId: number;
  strokes: number;
  relativeToPar: number;
}

/**
 * True when two player names are the same, ignoring case and surrounding space: a player added
 * as "ville" is Metrix's "Ville", as the database's case-insensitive collation already treats them.
 */
export function isSamePlayerName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("fi") === b.trim().toLocaleLowerCase("fi");
}

/** The round's players matching the chat's followed players by name (ignoring case); a name matching several is skipped. */
export function trackRoundPlayers(round: MetrixRound, tracked: readonly { id: number; name: string }[]): TrackedRoundPlayer[] {
  const result: TrackedRoundPlayer[] = [];

  for (const identity of tracked) {
    const matching = round.players.filter(player => isSamePlayerName(player.name, identity.name));
    if (matching.length === 1) result.push({ id: identity.id, player: matching[0] });
  }

  return result;
}

/** True once every tracked player has a complete card with totals, or is DNF. */
export function hasTrackedRoundEnded(players: readonly TrackedRoundPlayer[]): boolean {
  return players.length > 0 && players.every(({ player }) => {
    if (player.round.status === "dnf") return true;
    const totals = finalTotals(player);
    return isFullCard(player.scorecard, player.round.totalHoles) && totals.strokes !== null && totals.relativeToPar !== null;
  });
}

/** Total strokes of a finished round, or null while the round is unfinished or abandoned. */
export function completedRoundStrokes(player: RoundPlayer): number | null {
  return player.round.status === "complete" ? finalTotals(player).strokes : null;
}

export function finalTotals(player: RoundPlayer): FinalTotals {
  const card = player.scorecard;
  const recorded = card.kind === "available" && isFullCard(card, player.round.totalHoles) ? sumCard(card.holes) : null;
  return {
    strokes: player.totalStrokes ?? recorded?.strokes ?? null,
    relativeToPar: player.totalRelativeToPar ?? recorded?.relativeToPar ?? null,
  };
}

/** Players with a firm place and Metrix totals; provisional and DNF players are left out. */
export function selectRankedResults(players: readonly RoundPlayer[]): RankedResult[] {
  const results: RankedResult[] = [];
  for (const player of players) {
    const ranked = toRankedResult(player);
    if (ranked) results.push(ranked);
  }
  return results;
}

export function selectTrackedRankedResults(players: readonly TrackedRoundPlayer[]): TrackedRankedResult[] {
  return players.flatMap(({ id, player }) => {
    const ranked = toRankedResult(player);
    return ranked ? [{ ...ranked, playerId: id }] : [];
  });
}

export function selectFinalScores(players: readonly TrackedRoundPlayer[]): FinalScore[] {
  return players.flatMap(({ id, player }) => {
    const totals = finalTotals(player);
    if (player.round.status === "dnf" || totals.strokes === null || totals.relativeToPar === null) return [];
    return [{ playerId: id, strokes: totals.strokes, relativeToPar: totals.relativeToPar }];
  });
}

function toRankedResult(player: RoundPlayer): RankedResult | null {
  const { position, isProvisional } = player.standing;
  if (player.totalStrokes === null || player.totalRelativeToPar === null || position === null || isProvisional) return null;
  return {
    playerName: player.name, division: player.division, position,
    strokes: player.totalStrokes, relativeToPar: player.totalRelativeToPar,
  };
}

function isFullCard(scorecard: Scorecard, totalHoles: number | null): boolean {
  return scorecard.kind === "available" && scorecard.holes.length === totalHoles && scorecard.holes.every(hole => hole !== null);
}

function sumCard(holes: Extract<Scorecard, { kind: "available" }>["holes"]): FinalTotals {
  let strokes = 0;
  let relativeToPar: number | null = 0;
  for (const hole of holes) {
    if (hole === null) return { strokes: null, relativeToPar: null };
    strokes += hole.strokes;
    relativeToPar = hole.relativeToPar === null || relativeToPar === null ? null : relativeToPar + hole.relativeToPar;
  }
  return { strokes, relativeToPar };
}
