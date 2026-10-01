import { CommentaryFixture, FixtureHole, FixturePlayer } from "./fixtureFile";

export const REPLAY_ROUND_ID = "900001";
const REPLAY_USER_ID_BASE = 1000;
// Metrix's own placeholder for unranked players; the bot derives shared places from recorded totals.
const UNRANKED_ORDER_NUMBER = 0;

export interface ReplayStep {
  completedHoles: number;
  payload: unknown;
}

/**
 * The round as Metrix would have shown it after each hole: every player's card cut to its first
 * `completedHoles` holes, totals recomputed, places left for the bot to derive. Assumes everyone
 * plays in hole order, which real shotgun starts don't, but the facts stay internally consistent.
 */
export function buildReplaySteps(fixture: CommentaryFixture): ReplayStep[] {
  const totalHoles = fixture.tracks.length;
  const steps: ReplayStep[] = [];
  for (let completedHoles = 0; completedHoles <= totalHoles; completedHoles++) {
    steps.push({
      completedHoles,
      payload: {
        Competition: {
          ID: REPLAY_ROUND_ID, Name: fixture.description, Date: fixture.date, CourseName: fixture.courseName,
          HasSubcompetitions: 0, Tracks: fixture.tracks,
          Results: fixture.players.map((player, index) =>
            toReplayResult(player, index, completedHoles, completedHoles === totalHoles)),
        },
      },
    });
  }
  return steps;
}

function toReplayResult(player: FixturePlayer, index: number, completedHoles: number, isFinal: boolean) {
  const holes: FixtureHole[] = player.PlayerResults.map((hole, holeIndex) => (holeIndex < completedHoles ? hole : []));
  const recorded = holes.filter(isRecordedHole);
  return {
    Name: player.Name, ClassName: player.ClassName, Group: player.Group,
    UserID: REPLAY_USER_ID_BASE + index,
    DNF: isFinal ? player.DNF : null,
    OrderNumber: UNRANKED_ORDER_NUMBER,
    Sum: recorded.length > 0 ? recorded.reduce((sum, hole) => sum + hole.Result, 0) : null,
    Diff: sumDiffs(recorded),
    PlayerResults: holes,
  };
}

type RecordedHole = Exclude<FixtureHole, readonly never[]>;

function isRecordedHole(hole: FixtureHole): hole is RecordedHole {
  return !Array.isArray(hole);
}

function sumDiffs(holes: readonly RecordedHole[]): number | null {
  if (holes.length === 0) return null;
  let total = 0;
  for (const hole of holes) {
    if (hole.Diff === null) return null;
    total += hole.Diff;
  }
  return total;
}
