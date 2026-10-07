import { escapeHtml } from "../../shared/html";
import { RankedResult, selectRankedResults, selectTrackedRankedResults } from "../../integrations/metrix/round/results";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { buildRoundRatings, CourseInfo, truncateCourseName } from "../commentary";
import { rankTopList } from "./topListRanking";

/** What live scoring itself says in the chat. */
export const liveScoringMessages = {
  endSoon:         "Dodii, ne kisat oli sit siinä, tässä olis sit vielä lopputulokset!",
};

const OTHERS_HEADING = "Muut Sankarit";

/** The message that starts following: the course, the tracked players, and who still has no bagtag. */
export function formatPlayerAnnouncement(
  metrixId: string, courseName: string, playerNames: readonly string[], missingTags: readonly string[],
): string {
  const course = `<a href="https://discgolfmetrix.com/${metrixId}">${escapeHtml(truncateCourseName(courseName))}</a>`;
  let message = `Peliareenana toimii ${course}\n\nJa tällä kertaa kisassa on mukana:\n`;
  for (const name of playerNames) message += `${escapeHtml(name)}\n`;
  if (missingTags.length > 0) {
    message += `\n🏷️ Ilman tägiä: ${missingTags.map(escapeHtml).join(", ")}\nAseta: /bagtag set [nimi] [numero]`;
  }
  return message;
}

/** The TOP-5 of the round as it stands: per division, the tracked players outside it, ratings for finished rounds. */
export function formatRoundTopList(round: MetrixRound, tracked: readonly TrackedRoundPlayer[], course: CourseInfo): string {
  const ratings = buildRoundRatings(course.details?.rating ?? null, round.players);
  return formatTopList(round.name, selectRankedResults(round.players), selectTrackedRankedResults(tracked), ratings);
}

/** `roundRatings` holds finished rounds' ratings by player name; those rows show the rating after the score. */
export function formatTopList(
  competitionName: string, results: readonly RankedResult[], trackedPlayers: readonly RankedResult[], roundRatings: ReadonlyMap<string, number>,
): string {
  let message = `${competitionName} TOP-5\n\n`;
  for (const section of rankTopList(results, trackedPlayers)) {
    const heading = section.kind === "division" ? section.division : OTHERS_HEADING;
    message += `Sarja ${heading}\n`;
    for (const player of section.players) {
      // Places from different divisions would read as one ranking without the division.
      const suffix = section.kind === "others" ? ` (${player.division})` : "";
      const rating = roundRatings.get(player.playerName);
      const ratingPart = rating === undefined ? "" : ` (rating ${rating})`;
      message += `${player.position}. ${player.playerName}${suffix}\t\t\t\t${player.relativeToPar}${ratingPart}\n`;
    }
    message += "\n";
  }
  return message;
}
