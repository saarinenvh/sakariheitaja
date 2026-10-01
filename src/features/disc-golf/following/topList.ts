import { MetrixPlayerResult, TrackedPlayer } from "../../../types/metrix";

export function truncateCourseName(rawName: string): string {
  const name = rawName.replace(/&rarr;/g, "");
  return name.length > 38 ? `${name.slice(0, 37)}...` : name;
}

/** `roundRatings` holds finished rounds' ratings by player name; those rows show the rating after the score. */
export function formatTopList(
  competitionName: string, results: MetrixPlayerResult[], trackedPlayers: TrackedPlayer[], roundRatings: ReadonlyMap<string, number>,
): string {
  const divisions = [...new Set(results.map(r => r.ClassName))];
  const rankings: Record<string, MetrixPlayerResult[]> = {};

  for (const division of divisions) {
    rankings[division] = results
      .filter(r => r.ClassName === division && r.OrderNumber <= 5)
      .sort((a, b) => a.OrderNumber - b.OrderNumber);
  }

  // Tracked players outside their division's top 5, grouped so that players
  // from different divisions don't read as one ranking - sorting purely by
  // OrderNumber put an MA3 6th place above an MPO 8th as though they were
  // competing against each other, with nothing on the line to say otherwise.
  const OTHERS = "Muut Sankarit";
  const outsideTopFive = trackedPlayers.filter(player => player.OrderNumber > 5);
  if (outsideTopFive.length) {
    rankings[OTHERS] = [...outsideTopFive].sort(
      (a, b) => a.ClassName.localeCompare(b.ClassName) || a.OrderNumber - b.OrderNumber,
    );
  }

  let message = `${competitionName} TOP-5\n\n`;
  for (const [division, players] of Object.entries(rankings)) {
    message += `Sarja ${division}\n`;
    for (const player of players) {
      const suffix = division === OTHERS ? ` (${player.ClassName})` : "";
      const rating = roundRatings.get(player.Name);
      const ratingPart = rating === undefined ? "" : ` (rating ${rating})`;
      message += `${player.OrderNumber}. ${player.Name}${suffix}\t\t\t\t${player.Diff}${ratingPart}\n`;
    }
    message += "\n";
  }
  return message;
}
