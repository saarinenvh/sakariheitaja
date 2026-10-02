import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("challonge");

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

  const data = await res.json() as any;
  log.debug("Challonge v1 API fetch OK");

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

  log.debug({ matches: matches.length, participants: participants.length }, "Challonge bracket parsed");
  return { tournamentName: t?.name ?? "Tournament", participants, matches };
}

/** "yvept9b5" from "https://challonge.com/fi/yvept9b5". */
function tournamentSlug(tournamentUrl: string): string {
  return tournamentUrl.replace(/^.*challonge\.com\/(?:[a-z]{2}\/)?/, "").replace(/\/$/, "");
}
