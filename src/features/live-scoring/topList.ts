import { RankedResult, selectRankedResults, selectTrackedRankedResults } from "../../integrations/metrix/round/results";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { CourseInfo } from "../commentary/facts/courseCommentaryFacts";
import { buildRoundRatings } from "../commentary/facts/roundRatings";

/** The TOP-5 of the round as it stands: per division, the tracked players outside it, ratings for finished rounds. */
export function formatRoundTopList(round: MetrixRound, tracked: readonly TrackedRoundPlayer[], course: CourseInfo): string {
  const ratings = buildRoundRatings(course.details?.rating ?? null, round.players);
  return formatTopList(round.name, selectRankedResults(round.players), selectTrackedRankedResults(tracked), ratings);
}

/** `roundRatings` holds finished rounds' ratings by player name; those rows show the rating after the score. */
export function formatTopList(
  competitionName: string, results: readonly RankedResult[], trackedPlayers: readonly RankedResult[], roundRatings: ReadonlyMap<string, number>,
): string {
  const divisions = [...new Set(results.map(result => result.division))];
  const rankings: Record<string, RankedResult[]> = {};

  for (const division of divisions) {
    rankings[division] = results
      .filter(result => result.division === division && result.position <= 5)
      .sort((a, b) => a.position - b.position);
  }

  // Tracked players outside their division's top 5 carry their division, so places from different divisions don't read as one ranking.
  const OTHERS = "Muut Sankarit";
  const outsideTopFive = trackedPlayers.filter(player => player.position > 5);
  if (outsideTopFive.length) {
    rankings[OTHERS] = [...outsideTopFive].sort(
      (a, b) => a.division.localeCompare(b.division) || a.position - b.position,
    );
  }

  let message = `${competitionName} TOP-5\n\n`;
  for (const [division, players] of Object.entries(rankings)) {
    message += `Sarja ${division}\n`;
    for (const player of players) {
      const suffix = division === OTHERS ? ` (${player.division})` : "";
      const rating = roundRatings.get(player.playerName);
      const ratingPart = rating === undefined ? "" : ` (rating ${rating})`;
      message += `${player.position}. ${player.playerName}${suffix}\t\t\t\t${player.relativeToPar}${ratingPart}\n`;
    }
    message += "\n";
  }
  return message;
}
