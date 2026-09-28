import { TrackedPlayer, Change } from "../../../types/metrix";
import { ScoreRow } from "../../../db/repositories/ScoreRepository";
import * as scoreRepo from "../../../db/repositories/ScoreRepository";
import * as courseRepo from "../../../db/repositories/CourseRepository";
import { ScoreChange } from "../commentaryFacts";

export async function saveRecordedScores(
  playerId: number, changes: readonly ScoreChange[], chatId: number, competitionId: number, courseName: string,
): Promise<void> {
  const notable = changes.filter(change => change.kind === "recorded"
    && (change.score.strokes === 1 || change.score.relativeToPar === -2 || change.score.relativeToPar === -3));
  if (notable.length === 0) return;
  const course = await courseRepo.findByName(courseName);
  if (!course) return;
  const date = new Date().toISOString().slice(0, 10);
  for (const change of notable) {
    if (change.kind !== "recorded") continue;
    if (change.score.strokes === 1) await scoreRepo.addAce(date, playerId, chatId, course.id, competitionId);
    else if (change.score.relativeToPar === -3) await scoreRepo.addAlbatross(date, playerId, chatId, course.id, competitionId);
    else await scoreRepo.addEagle(date, playerId, chatId, course.id, competitionId);
  }
}

export async function saveResults(
  players: readonly Pick<TrackedPlayer, "id" | "Diff" | "Sum">[],
  chatId: number,
  courseId: number,
  competitionId: number
): Promise<void> {
  for (const player of players) {
    await scoreRepo.addResult(player.id, chatId, courseId, competitionId, player.Diff, player.Sum ?? 0);
  }
}

// Covers every hole in the change, not just the one being commentated. Only the
// latest hole gets a message, but a scorekeeper entering three holes at once
// still played all three - and an ace in the first of them is exactly the kind
// of thing these tables exist to remember. Previously anything but the single
// reported hole never reached here at all.
export async function saveSuperScore(change: Change, chatId: number, competitionId: number, courseName: string): Promise<void> {
  const { playerId } = change;

  const notable = [...(change.earlierHoles ?? []), { hole: change.hole, holeResult: change.holeResult }]
    .filter(h => h.holeResult.Diff <= -2 || parseInt(h.holeResult.Result) === 1);

  if (notable.length === 0) return;

  const course = await courseRepo.findByName(courseName);
  if (!course) return;

  const date = new Date().toISOString().slice(0, 10);

  for (const { holeResult } of notable) {
    if (parseInt(holeResult.Result) === 1) {
      await scoreRepo.addAce(date, playerId, chatId, course.id, competitionId);
    } else if (holeResult.Diff === -3) {
      await scoreRepo.addAlbatross(date, playerId, chatId, course.id, competitionId);
    } else if (holeResult.Diff === -2) {
      await scoreRepo.addEagle(date, playerId, chatId, course.id, competitionId);
    }
  }
}

export async function getByCourseName(name: string, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseName(name, chatId);
}

export async function getByCourseId(id: string | number, chatId: number): Promise<ScoreRow[]> {
  return scoreRepo.findByCourseId(id, chatId);
}
