# Score records

The history of finished rounds: courses, final results per player, and the aces, eagles and
albatrosses.

## Entry points

| Entry point | Called by |
| --- | --- |
| `syncSpecialScores` | live scoring, for each tracked player on every poll and at the round end (`../live-scoring/specialScoreSync.ts`). Adds the course first when it is new. |
| `getOrCreateCourse`, `saveResults` | `finishRound` (`../live-scoring/roundFinalizer.ts`) |
| `findCourseResults` | `/tulokset <course>` (`telegram/commands/score-records/`): a course id, or a name searched among the chat's courses with results (several matches are listed with their ids) |
| `buildSpecialScoreReport` | `/assat`, `/eaglet`, `/albatrossit` (`telegram/commands/score-records/specialScores.ts`) |

## Data

Owns the `courses`, `scores`, `aces`, `eagles` and `albatrosses` tables (`db/`). Results are saved
once per player and competition, so a retried round end doesn't save twice.

A special score is one row per competition, player and hole (unique key, `hole_number`). A sync
makes the player's rows in that round what their card says: the rows for other holes go, the
missing ones are added, and the rows that stay keep their id. The same card again changes
nothing, and an unavailable card leaves the rows alone. Rows saved before holes were recorded
(`hole_number` NULL) go only when their own round is synced; other rounds' rows are never touched.

## Files

| File | Does |
| --- | --- |
| `scoreRecords.ts` | Syncs special scores to a card and saves results, finds or adds a course, reads a course's best results. |
| `specialScoreReport.ts` | A chat's special scores of one kind for a period: resolves a course id, a course name (several matches are listed) or a player of the chat, then counts per player and the latest. |
| `policy.ts` | Which hole scores are notable, and which kind each is; the count per player and the latest. |
| `db/` | The `Course` entity and `courseRepository` (names unique, ignoring case); the `Score` entity and `scoreRepository`; the `Ace`, `Eagle` and `Albatross` entities (`SpecialScore.entity.ts`) and `specialScoreRepository`. |
