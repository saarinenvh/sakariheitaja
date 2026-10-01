import { WeatherObservation } from "../../../../shared/weather";
import { buildCourseCommentaryFacts, CourseInfo } from "../facts/holeFacts";
import { buildDivisionStandings, DivisionStanding } from "../facts/standings";
import { FactualCommentaryBrief } from "../facts/playerBrief";
import { describeLeadHistory, isPlayOrderKnown } from "../facts/leadHistory";
import { MetrixRound } from "../../metrix/metrixRound";
import { buildScorecardTable } from "../facts/scorecardTable";
import { buildSpokenNames } from "../facts/spokenNames";

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
  /** True for the first message delivered for this division since following started. */
  firstMessage: boolean;
  holeFacts: string | null;
  courseDifficulty: string | null;
  /** Ratings of the division's finished rounds, keyed by full player name; the result rows show all of them. */
  roundRatings: ReadonlyMap<string, number>;
  recentMessages: readonly string[];
  spokenNames: ReadonlyMap<string, string>;
}

export interface BatchContextInput {
  round: MetrixRound;
  division: string;
  briefs: readonly FactualCommentaryBrief[];
  weather: WeatherFacts | null;
  /** Latest observation, for wind relative to the hole; kept even when the weather isn't re-announced. */
  latestWeather: WeatherObservation | null;
  course: CourseInfo | null;
  firstMessage: boolean;
  recentMessages: readonly string[];
}

export function buildBatchCommentaryContext(input: BatchContextInput): BatchCommentaryContext {
  const divisionPlayers = input.round.players.filter(player => player.division === input.division);
  const spokenNames = buildSpokenNames(divisionPlayers.map(player => player.name));
  const displayName = (fullName: string): string => spokenNames.get(fullName) ?? fullName;
  const courseFacts = buildCourseCommentaryFacts({
    course: input.course, round: input.round, divisionPlayers, briefs: input.briefs, weather: input.latestWeather,
  });
  return {
    players: input.briefs,
    standings: buildDivisionStandings(input.round, input.division),
    scorecardTable: buildScorecardTable({
      holeLabels: input.round.holeLabels, players: divisionPlayers, newHoles: collectNewHoles(input.briefs), displayName,
    }),
    playOrderKnown: isPlayOrderKnown(divisionPlayers),
    leadHistory: describeLeadHistory(divisionPlayers, displayName),
    weather: input.weather,
    firstMessage: input.firstMessage,
    holeFacts: courseFacts.holeFacts,
    courseDifficulty: courseFacts.courseDifficulty,
    roundRatings: courseFacts.roundRatings,
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
