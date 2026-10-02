import { z } from "zod";
import { moduleLogger } from "../../shared/logger";
import { parseOrThrow } from "../../shared/validation";

const log = moduleLogger("challonge");

// Challonge v1 wraps each item ({ participant: {...} }, { match: {...} }) and the whole reply ({ tournament });
// the bare forms are accepted too.
const optionalId = z.number().int().nullish().transform(value => value ?? null);

const participantFields = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  display_name: z.string().nullish(),
});
const participantSchema = z.union([
  z.object({ participant: participantFields }).transform(wrapped => wrapped.participant),
  participantFields,
]);

const matchFields = z.object({
  round: z.number().int(),
  player1_id: optionalId,
  player2_id: optionalId,
  winner_id: optionalId,
  state: z.enum(["complete", "open", "pending"]),
  scores_csv: z.string().nullish().transform(value => value ?? null),
});
const matchSchema = z.union([z.object({ match: matchFields }).transform(wrapped => wrapped.match), matchFields]);

const tournamentFields = z.object({
  name: z.string().nullish(),
  participants: z.array(participantSchema),
  matches: z.array(matchSchema),
});
const bracketResponseSchema = z.union([
  z.object({ tournament: tournamentFields }).transform(wrapped => wrapped.tournament),
  tournamentFields,
]);

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

export interface ChallongeConfig {
  /** The tournament page, e.g. "https://challonge.com/fi/yvept9b5". */
  tournamentUrl: string;
  apiKey: string | undefined;
}

export interface ChallongeClient {
  /** The match-play bracket, structured; throws without an API key or on a failed request. */
  fetchBracket(): Promise<BracketData>;
}

export function createChallongeClient(config: ChallongeConfig): ChallongeClient {
  return { fetchBracket: () => fetchBracketData(config) };
}

async function fetchBracketData({ tournamentUrl, apiKey }: ChallongeConfig): Promise<BracketData> {
  if (!apiKey) throw new Error("CHALLONGE_API_KEY not set");

  const slug = tournamentSlug(tournamentUrl);
  const url = `https://api.challonge.com/v1/tournaments/${slug}.json?api_key=${apiKey}&include_participants=1&include_matches=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Challonge API ${res.status}`);

  const tournament = parseOrThrow(bracketResponseSchema, await res.json(), "Challonge bracket");
  log.debug("Challonge v1 API fetch OK");

  const participants = tournament.participants.map(part => ({
    id: part.id, name: part.name ?? part.display_name ?? `Player ${part.id}`,
  }));
  const matches: BracketMatch[] = tournament.matches.map(match => ({
    round: match.round,
    player1Id: match.player1_id,
    player2Id: match.player2_id,
    winnerId: match.winner_id,
    state: match.state,
    scoresCsv: match.scores_csv,
  }));

  log.debug({ matches: matches.length, participants: participants.length }, "Challonge bracket parsed");
  return { tournamentName: tournament.name ?? "Tournament", participants, matches };
}

/** "yvept9b5" from "https://challonge.com/fi/yvept9b5". */
function tournamentSlug(tournamentUrl: string): string {
  return tournamentUrl.replace(/^.*challonge\.com\/(?:[a-z]{2}\/)?/, "").replace(/\/$/, "");
}
