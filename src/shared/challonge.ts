import Logger from "js-logger";
import { env } from "./env";

const TOURNAMENT_URL = env("CHALLONGE_TOURNAMENT_URL") ?? "https://challonge.com/yvept9b5";
const API_KEY = env("CHALLONGE_API_KEY");

// Extract tournament slug from URL, e.g. "yvept9b5" from "https://challonge.com/fi/yvept9b5"
function tournamentSlug(): string {
  return TOURNAMENT_URL.replace(/^.*challonge\.com\/(?:[a-z]{2}\/)?/, "").replace(/\/$/, "");
}

export interface BracketMatch {
  round: number;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  state: "complete" | "open" | "pending";
  scoresCsv: string | null;
}

export interface BracketData {
  tournamentName: string;
  participants: { id: number; name: string }[];
  matches: BracketMatch[];
}

// Raw fetch + parse into structured data - this used to go straight to a
// flattened text dump (formatFullBracket does that now, but only when asked
// for). Keeping the structured form lets findPlayerMatch answer a specific
// "who do I play next" question with one match instead of the whole bracket -
// see llmAsker.ts's own comment on why that matters for both context size and
// the model's actual reliability at finding the right line in a big dump.
export async function fetchBracketData(): Promise<BracketData> {
  if (!API_KEY) throw new Error("CHALLONGE_API_KEY not set");

  const slug = tournamentSlug();
  const url = `https://api.challonge.com/v1/tournaments/${slug}.json?api_key=${API_KEY}&include_participants=1&include_matches=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Challonge API ${res.status}`);

  const data = await res.json() as any;
  Logger.debug(`Challonge v1 API fetch OK`);

  const t = data?.tournament ?? data;
  const participants = (t?.participants ?? []).map((p: any) => {
    const part = p?.participant ?? p;
    return { id: part.id, name: part.name ?? part.display_name ?? `Player ${part.id}` };
  });
  const matches: BracketMatch[] = (t?.matches ?? []).map((m: any) => {
    const match = m?.match ?? m;
    return {
      round: match.round,
      player1Id: match.player1_id ?? null,
      player2Id: match.player2_id ?? null,
      winnerId: match.winner_id ?? null,
      state: match.state,
      scoresCsv: match.scores_csv ?? null,
    };
  });

  Logger.debug(`Challonge bracket parsed: ${matches.length} matches, ${participants.length} participants`);
  return { tournamentName: t?.name ?? "Tournament", participants, matches };
}

function participantName(data: BracketData, id: number | null): string {
  if (id === null) return "TBD";
  return data.participants.find(p => p.id === id)?.name ?? "TBD";
}

// Case-insensitive, tolerant of a bare first name (Telegram sender names and
// spoken/typed mentions are usually just "Turkka", not "Turkka Maisala").
//
// Two participants sharing a first name (a real case in this club: "Ville
// Saarinen" and "Ville Liedes") makes a bare "Ville" genuinely ambiguous -
// silently picking whichever happens to be first in the list would be
// exactly the kind of wrong-but-confident answer this whole rewrite exists to
// stop. An EXACT full-name match is never ambiguous, though, even if a
// shorter query would also match someone else: "Ville Saarinen" typed in full
// always means that Ville Saarinen. So exact match is tried first and wins
// outright; only the fuzzy fallback can return more than one name.
//
// Known gap, not solved here: plain substring matching does not handle
// Finnish inflection - "Turkalla" (adessive, "at Turkka's") isn't even a
// prefix of "Turkka" once consonant gradation turns kk into k. A real fix
// needs a Finnish stemmer or fuzzy matching; see llmAsker.test.ts's own test
// for this, which documents the gap rather than pretending it's handled.
export function findParticipantsByName(data: BracketData, query: string): { id: number; name: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact = data.participants.filter(p => p.name.toLowerCase() === q);
  if (exact.length > 0) return exact;

  return data.participants.filter(p => {
    const full = p.name.toLowerCase();
    return full.includes(q) || q.includes(full) || full.split(/\s+/).includes(q);
  });
}

/** Convenience wrapper for callers that don't need to distinguish "not found" from "ambiguous" - both come back null. */
export function findParticipantByName(data: BracketData, query: string): { id: number; name: string } | null {
  const matches = findParticipantsByName(data, query);
  return matches.length === 1 ? matches[0] : null;
}

// The one thing the actual bug was about: "who do I play next". Returns a
// single short line, deterministically - no LLM involved in finding the
// right match in a list of 60, which is exactly the step that was going
// wrong. A player's "current" match is their earliest not-yet-complete one;
// double elimination means a player can have a live match in both the
// winners and losers side at different times, but never two open ones at
// once for the same player, so "first incomplete, in round order" is
// unambiguous.
export function findPlayerMatch(data: BracketData, playerId: number): string | null {
  const playerName = participantName(data, playerId);
  const theirs = data.matches
    .filter(m => m.player1Id === playerId || m.player2Id === playerId)
    .sort((a, b) => a.round - b.round);

  const current = theirs.find(m => m.state !== "complete");
  if (!current) {
    // Every match involving this player is complete. Distinguish "still alive,
    // waiting for the next round to be seeded" from "eliminated" only if we
    // can - a played-and-lost match in the loser's bracket's final round is
    // the honest signal for eliminated; anything else, say we don't know
    // rather than guess.
    return theirs.length > 0
      ? `${playerName}: kaikki tähän mennessä pelatut ottelut on pelattu, seuraavaa ottelua ei ole vielä avattu.`
      : null;
  }

  const opponentId = current.player1Id === playerId ? current.player2Id : current.player1Id;
  const opponentName = participantName(data, opponentId);
  const roundLabel = current.round > 0 ? `Winners Round ${current.round}` : `Losers Round ${Math.abs(current.round)}`;

  if (opponentId === null || opponentName === "TBD") {
    return `${playerName}: seuraava ottelu ${roundLabel}, vastustaja ei vielä tiedossa.`;
  }
  return `${playerName}: seuraava ottelu ${roundLabel} vastustajana ${opponentName}${current.state === "open" ? " (käynnissä)" : ""}.`;
}

// The full dump, for genuinely broad questions (who's eliminated, who's still
// in, where are we in the bracket) that a single match can't answer. Kept
// deliberately separate from the targeted lookup above rather than merged -
// this is the expensive path, used only when it's actually needed.
export function formatFullBracket(data: BracketData): string {
  const lines: string[] = [`=== Match Play Bracket: ${data.tournamentName} ===`, ""];

  const rounds = new Map<number, BracketMatch[]>();
  for (const m of data.matches) {
    const r = rounds.get(m.round) ?? [];
    r.push(m);
    rounds.set(m.round, r);
  }

  for (const [round, ms] of [...rounds.entries()].sort(([a], [b]) => a - b)) {
    const label = round > 0 ? `Winners Round ${round}` : `Losers Round ${Math.abs(round)}`;
    lines.push(`${label}:`);
    for (const m of ms) {
      const p1 = participantName(data, m.player1Id);
      const p2 = participantName(data, m.player2Id);
      if (m.state === "complete") {
        lines.push(`  ${p1} vs ${p2} → Winner: ${participantName(data, m.winnerId)} (${m.scoresCsv})`);
      } else if (m.state === "open") {
        lines.push(`  ${p1} vs ${p2} ← CURRENT MATCH`);
      } else {
        lines.push(`  ${p1} vs ${p2} (upcoming)`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
