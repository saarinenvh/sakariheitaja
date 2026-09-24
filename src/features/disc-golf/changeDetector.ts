import { MetrixApiResponse, MetrixHoleResult, TrackedPlayer, Change, HoleEntry, PlayedHole } from "../../types/metrix";

interface NormalizedHole {
  Result: string;
  Diff: string | number;
  PEN: number;
  Played: boolean;
  Index: number;
}

// Returns EVERY hole whose result changed, ascending. This used to return just
// the first one and stop: because the fresh snapshot then became the baseline,
// any further holes in the same batch could never differ again and were gone
// for good - not only unmentioned, but never passed to saveSuperScore, so an
// ace or eagle among them was silently missing from the stats tables forever.
// Rare at the 30s active poll interval, but the poller widens to 60s and 120s
// when nothing is changing and backs off exponentially to 600s after fetch
// errors, and a group gets through several holes in ten minutes.
function getChangedHoles(prevResults: HoleEntry[], newResults: HoleEntry[]): number[] {
  const normalize = (results: HoleEntry[]): NormalizedHole[] =>
    results.map((item, index) =>
      Array.isArray(item)
        ? { Result: "", Diff: "", PEN: 0, Played: false, Index: index }
        : { ...(item as MetrixHoleResult), Played: true, Index: index }
    );

  const oldHoles = normalize(prevResults);
  const newHoles = normalize(newResults);

  const changed: number[] = [];
  for (let i = 0; i < newHoles.length; i++) {
    if (newHoles[i].Result !== oldHoles[i]?.Result) changed.push(i);
  }
  return changed;
}

export function detectChanges(
  prevData: MetrixApiResponse,
  newData: MetrixApiResponse,
  trackedPlayers: TrackedPlayer[]
): Change[] {
  const changes: Change[] = [];

  for (const tracked of trackedPlayers) {
    const prevPlayer = prevData.Competition.Results.find(r => r.Name === tracked.Name);
    const newPlayer = newData.Competition.Results.find(r => r.Name === tracked.Name);

    if (!prevPlayer || !newPlayer) continue;
    if (!("Sum" in prevPlayer)) continue;
    if (prevPlayer.Sum === newPlayer.Sum) continue;

    const changedHoles = getChangedHoles(
      prevPlayer.PlayerResults ?? [],
      newPlayer.PlayerResults ?? []
    );

    // A hole can also change by being cleared or re-entered, which leaves no
    // result to report on. Dropping those individually (rather than abandoning
    // the whole player, as before) means a correction to an early hole no
    // longer suppresses commentary for a genuinely new one later in the card.
    const played: PlayedHole[] = [];
    for (const hole of changedHoles) {
      const holeResult = newPlayer.PlayerResults?.[hole];
      if (!holeResult || Array.isArray(holeResult)) continue;
      played.push({ hole, holeResult });
    }

    if (played.length === 0) continue;

    // Commentary covers the latest hole - one message per player per update,
    // about where they actually are now. The rest ride along for scoring.
    const latest = played[played.length - 1];

    changes.push({
      playerName: tracked.Name,
      playerId: tracked.id,
      prevPlayer,
      newPlayer,
      hole: latest.hole,
      holeResult: latest.holeResult,
      earlierHoles: played.slice(0, -1),
    });
  }

  return changes;
}

export function hasCompetitionEnded(trackedPlayers: TrackedPlayer[]): boolean {
  if (trackedPlayers.length === 0) return false;
  return trackedPlayers.every(player => {
    if (!player.PlayerResults || player.PlayerResults.length === 0) return false;
    return player.PlayerResults.every(hole => !Array.isArray(hole));
  });
}
