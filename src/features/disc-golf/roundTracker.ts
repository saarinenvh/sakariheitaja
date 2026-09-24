import { Change, MetrixPlayerResult } from "../../types/metrix";
import Logger from "js-logger";

interface NotableEvent {
  hole: number;
  playerName: string;
  label: string;
}

interface RoundState {
  events: NotableEvent[];
  lastSummaryHole: number;
}

const SUMMARY_INTERVAL = 6; // reset conversation every N holes

// Keyed by "<metrixId>::<division>", matching llmCommentary's conversation
// keys. Previously keyed by metrixId alone, which meant every division in a
// competition shared one event log - so a summary handed to the model as
// "merkittävät tapahtumat" listed other divisions' holes as if they were part
// of the round being commentated.
const states = new Map<string, RoundState>();

function holeScoreLabel(diff: number, result: string): string {
  if (parseInt(result) === 1) return "ässä";
  if (diff <= -3) return "albatrossi";
  if (diff === -2) return "kotka";
  if (diff === -1) return "birdie";
  if (diff === 0)  return "par";
  if (diff === 1)  return "bogi";
  if (diff === 2)  return "tuplabogi";
  return `${diff} yli parin`;
}

function addPlusSign(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export function initTracker(key: string): void {
  states.set(key, { events: [], lastSummaryHole: 0 });
}

// Takes a competition id, not a full key: clears every division's tracker for
// that competition in one call, since that's what "this competition is over"
// means.
export function clearTracker(metrixId: string): void {
  const prefix = `${metrixId}::`;
  for (const key of [...states.keys()]) {
    if (key === metrixId || key.startsWith(prefix)) states.delete(key);
  }
}

export function recordEvent(key: string, change: Change): void {
  // Created on demand - a competition's divisions only become known as their
  // results arrive, so there's no point at which they could all be pre-created.
  let state = states.get(key);
  if (!state) {
    state = { events: [], lastSummaryHole: 0 };
    states.set(key, state);
  }

  const { holeResult, newPlayer, prevPlayer, hole } = change;
  const score = holeScoreLabel(holeResult.Diff, holeResult.Result);
  const ob = holeResult.PEN > 0 ? " + OB" : "";
  const posChange = newPlayer.OrderNumber < prevPlayer.OrderNumber ? " (nousi)"
    : newPlayer.OrderNumber > prevPlayer.OrderNumber ? " (putosi)" : "";

  // Only record notable events — skip plain pars with no position change
  const isNotable = holeResult.Diff !== 0 || holeResult.PEN > 0 || posChange !== "";
  if (!isNotable) return;

  state.events.push({
    hole: hole + 1,
    playerName: newPlayer.Name,
    label: `${score}${ob}${posChange}`,
  });
}

export function shouldResetConversation(key: string, currentHole: number): boolean {
  const state = states.get(key);
  if (!state) return false;
  return (currentHole - state.lastSummaryHole) >= SUMMARY_INTERVAL;
}

// `results` must already be narrowed to this key's division - the standings
// block below is presented to the model as fact.
export function buildSummary(key: string, currentHole: number, totalHoles: number, results: MetrixPlayerResult[]): string {
  const state = states.get(key);
  if (!state) return "";

  const sorted = [...results].sort((a, b) => a.OrderNumber - b.OrderNumber).slice(0, 5);

  const standingsLines = sorted.map(p =>
    `  - ${p.Name}: ${addPlusSign(p.Diff)}, sija ${p.OrderNumber}`
  ).join("\n");

  const eventLines = state.events.length > 0
    ? state.events.map(e => `  - Väylä ${e.hole}: ${e.playerName} — ${e.label}`).join("\n")
    : "  - Ei merkittäviä tapahtumia";

  state.lastSummaryHole = currentHole;
  Logger.info(`LLM conversation reset with summary at hole ${currentHole}/${totalHoles} for ${key}`);

  return `[KIERROKSEN TIIVISTELMÄ — Väylä ${currentHole}/${totalHoles}]

Tilanne nyt:
${standingsLines}

Merkittävät tapahtumat tähän asti:
${eventLines}

Jatka kommentointia tästä eteenpäin. Käytä yllä olevaa tiivistelmää faktapohjana.`;
}
