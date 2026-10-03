import { BracketData, BracketMatch } from "../../integrations/challonge/client";
import { moduleLogger } from "../../shared/logger";

// Answers about the match-play bracket: who a question is about, who they play next, and the
// whole bracket as text for the model.

const log = moduleLogger("asker");

function participantName(data: BracketData, id: number | null): string {
  if (id === null) return "TBD";
  return data.participants.find(p => p.id === id)?.name ?? "TBD";
}

// Case-insensitive, and a bare first name matches. An exact full-name match wins outright; only
// the fuzzy fallback can return several people (two participants may share a first name).
// Finnish inflection ("Turkalla" for "Turkka") is not handled.
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

/**
 * A player's next match as one line, without the model. Their current match is the earliest
 * incomplete one in round order: in double elimination a player never has two open at once.
 */
export function findPlayerMatch(data: BracketData, playerId: number): string | null {
  const playerName = participantName(data, playerId);
  const theirs = data.matches
    .filter(m => m.player1Id === playerId || m.player2Id === playerId)
    .sort((a, b) => a.round - b.round);

  const current = theirs.find(m => m.state !== "complete");
  if (!current) {
    // All their matches are played; whether they are out or waiting for the next round is not known.
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

/** The whole bracket, for broader questions (who is out, where the bracket is) that one match can't answer. */
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

/**
 * The player a question is about: a name in the question wins over the sender's own name. Every word
 * is tried, so a last name elsewhere in the question settles an ambiguous first name. Null when no one
 * resolves to exactly one person; the caller then uses the whole bracket instead of guessing.
 */
export function resolveTargetPlayer(data: BracketData, question: string, senderName?: string): { id: number; name: string } | null {
  const words = question.split(/\s+/);
  let sawAmbiguous = false;

  for (const word of words) {
    const cleaned = trimTrailingPunctuation(word);
    if (cleaned.length < 3) continue;
    const matches = findParticipantsByName(data, cleaned);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) sawAmbiguous = true;
  }

  if (senderName) {
    const matches = findParticipantsByName(data, senderName);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) sawAmbiguous = true;
  }

  if (sawAmbiguous) {
    log.warn({ question, senderName }, "bracket name lookup ambiguous; using the full bracket rather than guessing");
  }
  return null;
}

const TRAILING_PUNCTUATION = new Set([".", ",", "!", "?", ":", ";"]);

function trimTrailingPunctuation(word: string): string {
  let end = word.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(word[end - 1])) end--;
  return word.slice(0, end);
}
