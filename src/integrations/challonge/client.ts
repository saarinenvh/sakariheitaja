import { httpGet } from "../../shared/http";
import { moduleLogger } from "../../shared/logger";
import { parseOrThrow } from "../../shared/validation";
import { bracketSchema } from "./schema";

const log = moduleLogger("challonge");

const TOURNAMENTS_API_URL = "https://api.challonge.com/v1/tournaments/";

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

  const url = buildBracketUrl(tournamentSlug(tournamentUrl), apiKey);

  const result = await httpGet(url, { headers: { Accept: "application/json" } });
  if (result.kind === "http-error") throw new Error(`Challonge API ${result.status}`);
  if (result.kind === "failed") throw new Error(`Challonge API request failed: ${result.reason}`);

  const tournament = parseOrThrow(bracketSchema, JSON.parse(result.text), "Challonge bracket");
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

/** The tournament with its participants and matches, in one request. */
function buildBracketUrl(slug: string, apiKey: string): string {
  return `${TOURNAMENTS_API_URL}${encodeURIComponent(slug)}.json`
    + `?api_key=${encodeURIComponent(apiKey)}&include_participants=1&include_matches=1`;
}

/** "yvept9b5" from "https://challonge.com/fi/yvept9b5". */
function tournamentSlug(tournamentUrl: string): string {
  return tournamentUrl.replace(/^.*challonge\.com\/(?:[a-z]{2}\/)?/, "").replace(/\/$/, "");
}
