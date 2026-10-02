import { HoleScore } from "../../../../integrations/metrix/round/types";
import { formatHoleScore } from "./holeResults";
import { RoundPlayer } from "../../../../integrations/metrix/round/types";

const NOT_RECORDED = "-";
const UNKNOWN_PAR = "?";
const NEW_RESULT_MARK = "*";

export interface ScorecardTableInput {
  holeLabels: readonly string[];
  players: readonly RoundPlayer[];
  /** Hole numbers (1-based) recorded or changed in the current update, keyed by full player name. */
  newHoles: ReadonlyMap<string, ReadonlySet<number>>;
  displayName: (fullName: string) => string;
}

interface TablePlayer {
  name: string;
  holes: readonly (HoleScore | null)[];
}

/** One division's scorecard as a text table, with a row for every hole anyone has recorded. */
export function buildScorecardTable(input: ScorecardTableInput): string | null {
  const players = collectTablePlayers(input.players);
  if (players.length === 0) return null;
  const rows: string[][] = [];
  input.holeLabels.forEach((label, index) => {
    const scores = players.map(player => player.holes[index] ?? null);
    if (scores.every(score => score === null)) return;
    const cells = players.map((player, playerIndex) =>
      formatCell(scores[playerIndex], input.newHoles.get(player.name)?.has(index + 1) ?? false));
    rows.push([label, formatPar(scores), ...cells]);
  });
  if (rows.length === 0) return null;
  const header = ["Väylä", "Par", ...players.map(player => input.displayName(player.name))];
  return [header, ...rows].map(row => row.join(" | ")).join("\n");
}

function collectTablePlayers(players: readonly RoundPlayer[]): TablePlayer[] {
  const tablePlayers: TablePlayer[] = [];
  for (const player of players) {
    if (player.scorecard.kind === "available") tablePlayers.push({ name: player.name, holes: player.scorecard.holes });
  }
  return tablePlayers;
}

function formatCell(score: HoleScore | null, isNew: boolean): string {
  if (score === null) return NOT_RECORDED;
  return isNew ? `${formatHoleScore(score)}${NEW_RESULT_MARK}` : formatHoleScore(score);
}

function formatPar(scores: readonly (HoleScore | null)[]): string {
  const known = scores.find(score => score !== null && score.relativeToPar !== null);
  return known && known.relativeToPar !== null ? String(known.strokes - known.relativeToPar) : UNKNOWN_PAR;
}
