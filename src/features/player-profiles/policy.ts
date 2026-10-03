import type { PlayerProfile } from "./playerProfiles";

/** How far a round's place share must be from the average to count as hot or cold form. */
const FORM_CHANGE_THRESHOLD = 0.15;
const AVERAGE_PRECISION = 1000;

/** One finished round of a player, scored as their place's share of their division's field. */
export interface ProfileRound {
  positionPct: number;
  competitionId: number;
  date: string;
}

/** The profile after one more round: the running average, and the form against the average before it. */
export function profileAfterRound(existing: PlayerProfile | undefined, round: ProfileRound): PlayerProfile {
  const prevGames = existing?.gamesPlayed ?? 0;
  const prevAvgPct = existing?.avgPositionPct ?? round.positionPct;
  const newAvgPct = (prevAvgPct * prevGames + round.positionPct) / (prevGames + 1);

  const recentForm: PlayerProfile["recentForm"] =
    round.positionPct < prevAvgPct - FORM_CHANGE_THRESHOLD ? "hot" :
    round.positionPct > prevAvgPct + FORM_CHANGE_THRESHOLD ? "cold" :
    "steady";

  return {
    ...(existing ?? {}),
    recentForm,
    gamesPlayed: prevGames + 1,
    avgPositionPct: Math.round(newAvgPct * AVERAGE_PRECISION) / AVERAGE_PRECISION,
    lastUpdated: round.date,
    lastCompetitionId: round.competitionId,
  };
}
