import { Scorecard } from "../../../../integrations/metrix/round/scorecard";
import { RoundPlayer } from "../../../../integrations/metrix/round/normalize";

export const MIN_HOLES_FOR_HISTORY = 2;
export const RECENT_WINDOW_HOLES = 6;
const MIN_PLAYERS_FOR_HISTORY = 2;

interface ScoredPlayer {
  displayName: string;
  cumulativeRelativeToPar: readonly number[];
}

interface LeaderEntry {
  playerIndex: number;
  displayName: string;
  firstLedHoleIndex: number;
}

interface LeadHistory {
  holesPlayed: number;
  leadChanges: number;
  everLeaders: readonly string[];
  currentLeaders: readonly string[];
  currentLeadStreakHoles: number;
  recentWindowHoles: number;
  maxRecentGapStrokes: number;
}

export function describeLeadHistory(
  players: readonly RoundPlayer[],
  displayName: (fullName: string) => string,
): string | null {
  const scored = buildScoredPlayers(players, displayName);
  if (scored === null) return null;
  return formatLeadHistory(analyzeLeadHistory(scored));
}

/** True when every active player's recorded holes run 1..k without gaps, so hole order is play order. */
export function isPlayOrderKnown(players: readonly RoundPlayer[]): boolean {
  return players.filter(player => player.round.status !== "dnf").every(player =>
    player.scorecard.kind === "available" && recordedPrefixLength(player.scorecard.holes) !== null);
}

function buildScoredPlayers(
  players: readonly RoundPlayer[],
  displayName: (fullName: string) => string,
): ScoredPlayer[] | null {
  const remaining = players.filter(player => player.round.status !== "dnf" && player.scorecard.kind === "available");
  if (remaining.length < MIN_PLAYERS_FOR_HISTORY) return null;
  const holesPlayed = sharedRecordedPrefixLength(remaining.map(player => player.scorecard));
  if (holesPlayed === null || holesPlayed < MIN_HOLES_FOR_HISTORY) return null;
  const scored: ScoredPlayer[] = [];
  for (const player of remaining) {
    const cumulative = cumulativeRelativeToPar(player.scorecard, holesPlayed);
    if (cumulative === null) return null;
    scored.push({ displayName: displayName(player.name), cumulativeRelativeToPar: cumulative });
  }
  return scored;
}

// Chronology is only known when everyone has played the same holes 1..k in order;
// shotgun starts or unequal progress make "who led after hole i" meaningless.
function sharedRecordedPrefixLength(scorecards: readonly Scorecard[]): number | null {
  let shared: number | null = null;
  for (const scorecard of scorecards) {
    if (scorecard.kind !== "available") return null;
    const prefix = recordedPrefixLength(scorecard.holes);
    if (prefix === null || (shared !== null && prefix !== shared)) return null;
    shared = prefix;
  }
  return shared;
}

function recordedPrefixLength(holes: Extract<Scorecard, { kind: "available" }>["holes"]): number | null {
  const firstMissing = holes.findIndex(hole => hole === null);
  if (firstMissing === -1) return holes.length;
  const hasLaterScore = holes.slice(firstMissing).some(hole => hole !== null);
  return hasLaterScore ? null : firstMissing;
}

function cumulativeRelativeToPar(scorecard: Scorecard, holesPlayed: number): number[] | null {
  if (scorecard.kind !== "available") return null;
  const cumulative: number[] = [];
  let total = 0;
  for (const hole of scorecard.holes.slice(0, holesPlayed)) {
    if (hole === null || hole.relativeToPar === null) return null;
    total += hole.relativeToPar;
    cumulative.push(total);
  }
  return cumulative;
}

function analyzeLeadHistory(players: readonly ScoredPlayer[]): LeadHistory {
  const holesPlayed = players[0].cumulativeRelativeToPar.length;
  const leaderSets: Set<number>[] = [];
  for (let holeIndex = 0; holeIndex < holesPlayed; holeIndex++) leaderSets.push(leadersAfterHole(players, holeIndex));

  let leadChanges = 0;
  let currentLeadStreakHoles = 1;
  for (let holeIndex = 1; holeIndex < holesPlayed; holeIndex++) {
    if (sameMembers(leaderSets[holeIndex], leaderSets[holeIndex - 1])) {
      currentLeadStreakHoles++;
    } else {
      leadChanges++;
      currentLeadStreakHoles = 1;
    }
  }

  const leaderEntries = collectLeaderEntries(players, leaderSets);
  const currentLeaderSet = leaderSets[holesPlayed - 1];
  const recentWindowHoles = Math.min(holesPlayed, RECENT_WINDOW_HOLES);
  return {
    holesPlayed,
    leadChanges,
    everLeaders: leaderEntries.map(entry => entry.displayName),
    currentLeaders: leaderEntries.filter(entry => currentLeaderSet.has(entry.playerIndex)).map(entry => entry.displayName),
    currentLeadStreakHoles,
    recentWindowHoles,
    maxRecentGapStrokes: maxLeaderGap(players, holesPlayed - recentWindowHoles, holesPlayed),
  };
}

function leadersAfterHole(players: readonly ScoredPlayer[], holeIndex: number): Set<number> {
  const best = Math.min(...players.map(player => player.cumulativeRelativeToPar[holeIndex]));
  const leaders = new Set<number>();
  players.forEach((player, playerIndex) => {
    if (player.cumulativeRelativeToPar[holeIndex] === best) leaders.add(playerIndex);
  });
  return leaders;
}

function sameMembers(first: ReadonlySet<number>, second: ReadonlySet<number>): boolean {
  return first.size === second.size && [...first].every(member => second.has(member));
}

function collectLeaderEntries(players: readonly ScoredPlayer[], leaderSets: readonly Set<number>[]): LeaderEntry[] {
  const entries = new Map<number, LeaderEntry>();
  leaderSets.forEach((leaders, holeIndex) => {
    for (const playerIndex of leaders) {
      if (entries.has(playerIndex)) continue;
      entries.set(playerIndex, { playerIndex, displayName: players[playerIndex].displayName, firstLedHoleIndex: holeIndex });
    }
  });
  return [...entries.values()].sort((first, second) => first.firstLedHoleIndex - second.firstLedHoleIndex
    || first.displayName.localeCompare(second.displayName, "fi"));
}

function maxLeaderGap(players: readonly ScoredPlayer[], fromHoleIndex: number, toHoleIndex: number): number {
  let maxGap = 0;
  for (let holeIndex = fromHoleIndex; holeIndex < toHoleIndex; holeIndex++) {
    const [best, secondBest] = players.map(player => player.cumulativeRelativeToPar[holeIndex]).sort((first, second) => first - second);
    maxGap = Math.max(maxGap, secondBest - best);
  }
  return maxGap;
}

function formatLeadHistory(history: LeadHistory): string {
  const sentences = history.leadChanges === 0
    ? [describeWireToWire(history)]
    : [
      `Johto on vaihtunut ${countTimes(history.leadChanges)} ${history.holesPlayed} väylän aikana.`,
      `Kärjessä ovat olleet ${joinNames(history.everLeaders)}.`,
      describeCurrentLead(history),
    ];
  sentences.push(describeRecentGap(history));
  return sentences.join(" ");
}

function describeWireToWire(history: LeadHistory): string {
  const [soleLeader] = history.currentLeaders;
  if (history.currentLeaders.length === 1) return `${soleLeader} on johtanut kaikki ${history.holesPlayed} pelattua väylää.`;
  return `${joinNames(history.currentLeaders)} ovat jakaneet johdon kaikki ${history.holesPlayed} pelattua väylää.`;
}

function describeCurrentLead(history: LeadHistory): string {
  const [soleLeader] = history.currentLeaders;
  const current = history.currentLeaders.length === 1
    ? `Nyt johtaa ${soleLeader}.`
    : `Nyt kärjessä tasatilanne: ${joinNames(history.currentLeaders)}.`;
  const streak = history.currentLeadStreakHoles === 1
    ? "Kärki muuttui viimeisimmällä väylällä."
    : `Sama kärki on pysynyt ${history.currentLeadStreakHoles} väylää putkeen.`;
  return `${current} ${streak}`;
}

function describeRecentGap(history: LeadHistory): string {
  const window = `viimeisillä ${history.recentWindowHoles} väylällä`;
  if (history.maxRecentGapStrokes === 0) return `Kärki on ollut tasan ${window}.`;
  return `Kärjen ero on ollut ${window} enintään ${countStrokes(history.maxRecentGapStrokes)}.`;
}

function countTimes(count: number): string {
  return count === 1 ? "kerran" : `${count} kertaa`;
}

function countStrokes(count: number): string {
  return count === 1 ? "1 heitto" : `${count} heittoa`;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ja ${names[names.length - 1]}`;
}
