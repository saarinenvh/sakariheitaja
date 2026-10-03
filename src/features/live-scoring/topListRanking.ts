import { RankedResult } from "../../integrations/metrix/round/results";

const TOP_LIST_SIZE = 5;

/** One part of the TOP-5: a division's top players, or the tracked players outside their division's top. */
export type TopListSection =
  | { kind: "division"; division: string; players: RankedResult[] }
  | { kind: "others"; players: RankedResult[] };

/**
 * Each division's top five by place, then the tracked players outside their division's top five,
 * sorted by division and place. The others section is left out when there is nobody in it.
 */
export function rankTopList(results: readonly RankedResult[], trackedPlayers: readonly RankedResult[]): TopListSection[] {
  const divisions = [...new Set(results.map(result => result.division))];
  const rankings: Record<string, RankedResult[]> = {};

  for (const division of divisions) {
    rankings[division] = results
      .filter(result => result.division === division && result.position <= TOP_LIST_SIZE)
      .sort((a, b) => a.position - b.position);
  }

  const sections: TopListSection[] = Object.entries(rankings)
    .map(([division, players]) => ({ kind: "division", division, players }));

  const outsideTopList = trackedPlayers.filter(player => player.position > TOP_LIST_SIZE);
  if (outsideTopList.length) {
    sections.push({
      kind: "others",
      players: [...outsideTopList].sort((a, b) => a.division.localeCompare(b.division) || a.position - b.position),
    });
  }
  return sections;
}
