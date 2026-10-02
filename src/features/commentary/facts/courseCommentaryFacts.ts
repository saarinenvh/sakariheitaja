import { WeatherObservation } from "../../../integrations/openweather/client";
import { buildRoundRatings, describeCourseDifficulty } from "./roundRatings";
import { describeHoleHistory, describeHoleLength, describeTodayFieldAverage, describeWindOnHole } from "./holeDescriptions";
import { CourseStatistics } from "../../../integrations/metrix/statistics/courseStatistics";
import { FactualCommentaryBrief } from "./playerBrief";
import { CourseDetails } from "../../../integrations/metrix/course/courseDetails";
import { MetrixRound, RoundPlayer } from "../../../integrations/metrix/round/types";

/** What the round knows about its course; either part is missing when Metrix doesn't provide it. */
export interface CourseInfo {
  details: CourseDetails | null;
  statistics: CourseStatistics | null;
}

export interface CourseCommentaryFacts {
  /** Facts about this update's hole(s), one sentence group per hole. */
  holeFacts: string | null;
  courseDifficulty: string | null;
  /** Ratings of the division's finished rounds, keyed by full player name. */
  roundRatings: ReadonlyMap<string, number>;
}

export interface CourseFactsInput {
  course: CourseInfo | null;
  round: MetrixRound;
  divisionPlayers: readonly RoundPlayer[];
  briefs: readonly FactualCommentaryBrief[];
  weather: WeatherObservation | null;
}

export function buildCourseCommentaryFacts(input: CourseFactsInput): CourseCommentaryFacts {
  const details = input.course?.details ?? null;
  return {
    holeFacts: describeUpdatedHoles(input),
    courseDifficulty: details ? describeCourseDifficulty(details.rating, coursePar(details)) : null,
    roundRatings: buildRoundRatings(details?.rating ?? null, input.divisionPlayers),
  };
}

function describeUpdatedHoles(input: CourseFactsInput): string | null {
  const holeNumbers = [...new Set(input.briefs.flatMap(brief => brief.changes.map(change => change.holeNumber)))].sort((a, b) => a - b);
  const descriptions = holeNumbers.map(holeNumber => describeHole(input, holeNumber)).filter((text): text is string => text !== null);
  return descriptions.length > 0 ? descriptions.join(" ") : null;
}

function describeHole(input: CourseFactsInput, holeNumber: number): string | null {
  const index = holeNumber - 1;
  const label = input.round.holeLabels[index] ?? String(holeNumber);
  const details = input.course?.details ?? null;
  const statistics = input.course?.statistics ?? null;
  const layoutHole = details ? findByLabel(details.holes, label, index, input.round.holeLabels.length) : undefined;
  const historyHole = statistics ? findByLabel(statistics.holes, label, index, input.round.holeLabels.length) : undefined;
  const facts = [
    layoutHole && details ? describeHoleLength(layoutHole, details.holes) : null,
    layoutHole ? describeWindOnHole(layoutHole, input.weather?.windFromDeg ?? null, input.weather?.windSpeedMs ?? null) : null,
    historyHole && statistics ? describeHoleHistory({ ...historyHole, aces: historyHole.counts?.aces ?? null }, statistics.holes.length) : null,
    describeTodayFieldAverage(input.divisionPlayers, index),
  ].filter((text): text is string => text !== null);
  return facts.length > 0 ? `Väylä ${label}: ${facts.join(" ")}` : null;
}

/** Layout data is community-edited: match the round's hole by label, else by position when the hole counts agree. */
function findByLabel<Hole extends { label: string }>(holes: readonly Hole[], label: string, index: number, roundHoleCount: number): Hole | undefined {
  return holes.find(hole => hole.label === label) ?? (holes.length === roundHoleCount ? holes[index] : undefined);
}

function coursePar(details: CourseDetails): number | null {
  if (details.holes.length === 0) return null;
  let total = 0;
  for (const hole of details.holes) {
    if (hole.par === null) return null;
    total += hole.par;
  }
  return total;
}
