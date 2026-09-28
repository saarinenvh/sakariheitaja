import { buildDivisionStandings, DivisionStanding } from "./competitionFacts";
import { FactualCommentaryBrief } from "./factualCommentaryBrief";
import { describeLeadHistory, isPlayOrderKnown } from "./leadHistory";
import { MetrixRound } from "./metrixRound";
import { buildScorecardTable } from "./scorecardTable";
import { buildSpokenNames } from "./spokenNames";

export interface WeatherFacts {
  current: string;
  changeSinceStart: string | null;
}

/** Everything the writer may use for one division's update; names inside strings are already spoken names. */
export interface BatchCommentaryContext {
  players: readonly FactualCommentaryBrief[];
  standings: readonly DivisionStanding[];
  scorecardTable: string | null;
  playOrderKnown: boolean;
  leadHistory: string | null;
  weather: WeatherFacts | null;
  recentMessages: readonly string[];
  spokenNames: ReadonlyMap<string, string>;
}

export interface BatchContextInput {
  round: MetrixRound;
  division: string;
  briefs: readonly FactualCommentaryBrief[];
  weather: WeatherFacts | null;
  recentMessages: readonly string[];
}

export function buildBatchCommentaryContext(input: BatchContextInput): BatchCommentaryContext {
  const divisionPlayers = input.round.players.filter(player => player.division === input.division);
  const spokenNames = buildSpokenNames(divisionPlayers.map(player => player.name));
  const displayName = (fullName: string): string => spokenNames.get(fullName) ?? fullName;
  return {
    players: input.briefs,
    standings: buildDivisionStandings(input.round, input.division),
    scorecardTable: buildScorecardTable({
      holeLabels: input.round.holeLabels, players: divisionPlayers, newHoles: collectNewHoles(input.briefs), displayName,
    }),
    playOrderKnown: isPlayOrderKnown(divisionPlayers),
    leadHistory: describeLeadHistory(divisionPlayers, displayName),
    weather: input.weather,
    recentMessages: input.recentMessages,
    spokenNames,
  };
}

function collectNewHoles(briefs: readonly FactualCommentaryBrief[]): Map<string, Set<number>> {
  const newHoles = new Map<string, Set<number>>();
  for (const brief of briefs) {
    newHoles.set(brief.playerName, new Set(brief.changes.map(change => change.holeNumber)));
  }
  return newHoles;
}
