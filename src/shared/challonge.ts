import Logger from "js-logger";
import { env } from "./env";

const TOURNAMENT_URL = env("CHALLONGE_TOURNAMENT_URL") ?? "https://challonge.com/yvept9b5";
const API_KEY = env("CHALLONGE_API_KEY");

// Extract tournament slug from URL, e.g. "yvept9b5" from "https://challonge.com/fi/yvept9b5"
function tournamentSlug(): string {
  return TOURNAMENT_URL.replace(/^.*challonge\.com\/(?:[a-z]{2}\/)?/, "").replace(/\/$/, "");
}

export async function fetchBracket(): Promise<string> {
  if (!API_KEY) throw new Error("CHALLONGE_API_KEY not set");

  const slug = tournamentSlug();
  const url = `https://api.challonge.com/v1/tournaments/${slug}.json?api_key=${API_KEY}&include_participants=1&include_matches=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Challonge API ${res.status}`);

  const data = await res.json() as any;
  Logger.debug(`Challonge v1 API fetch OK`);
  return formatJsonBracket(data);
}

function formatJsonBracket(data: any): string {
  const t = data?.tournament ?? data;
  const tournamentName = t?.name ?? "Tournament";
  const participants: any[] = t?.participants ?? [];
  const matches: any[] = t?.matches ?? [];

  const nameById = new Map<number, string>();
  for (const p of participants) {
    const part = p?.participant ?? p;
    nameById.set(part.id, part.name ?? part.display_name ?? `Player ${part.id}`);
  }

  const name = (id: number | null) => (id ? nameById.get(id) ?? "TBD" : "TBD");

  const lines: string[] = [`=== Match Play Bracket: ${tournamentName} ===`, ""];

  const rounds = new Map<number, any[]>();
  for (const m of matches) {
    const match = m?.match ?? m;
    const r = rounds.get(match.round) ?? [];
    r.push(match);
    rounds.set(match.round, r);
  }

  for (const [round, ms] of [...rounds.entries()].sort(([a], [b]) => a - b)) {
    const label = round > 0 ? `Winners Round ${round}` : `Losers Round ${Math.abs(round)}`;
    lines.push(`${label}:`);
    for (const m of ms) {
      const p1 = name(m.player1_id);
      const p2 = name(m.player2_id);
      if (m.state === "complete") {
        lines.push(`  ${p1} vs ${p2} → Winner: ${name(m.winner_id)} (${m.scores_csv})`);
      } else if (m.state === "open") {
        lines.push(`  ${p1} vs ${p2} ← CURRENT MATCH`);
      } else {
        lines.push(`  ${p1} vs ${p2} (upcoming)`);
      }
    }
    lines.push("");
  }

  Logger.debug(`Challonge bracket parsed: ${matches.length} matches, ${participants.length} participants`);
  return lines.join("\n");
}
