# Score records

The history of finished rounds: courses, final results per player, and the aces, eagles and
albatrosses.

## Entry points

| Entry point | Called by |
| --- | --- |
| `saveRecordedScores` | commentary, with the message that reports the scores (`../live-scoring/liveScoring.ts` wires it) |
| `getOrCreateCourse`, `saveResults` | `finishRound` (`../live-scoring/roundFinalizer.ts`) |
| `getByCourseName`, `getByCourseId` | `/tulokset <course>` (`telegram/commands/score-records/`) |

## Data

Owns the `courses`, `scores`, `aces`, `eagles` and `albatrosses` tables (`db/`). Results are saved
once per player and competition, so a retried round end doesn't save twice.

## Files

| File | Does |
| --- | --- |
| `scoreRecords.ts` | Saves notable scores and results, finds or adds a course, reads a course's best results. |
| `policy.ts` | Which hole scores are notable, and which kind each is. |
| `db/` | The `Course` entity, `courseRepository` and `scoreRepository` (raw SQL). |
