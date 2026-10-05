# Score records

The history of finished rounds: courses, final results per player, and the aces, eagles and
albatrosses.

## Entry points

| Entry point | Called by |
| --- | --- |
| `updateSpecialScores` | commentary, before it writes the message about those holes (`../live-scoring/liveScoring.ts` wires it). Adds the course first when it is new. |
| `getOrCreateCourse`, `saveResults` | `finishRound` (`../live-scoring/roundFinalizer.ts`) |
| `getByCourseName`, `getByCourseId` | `/tulokset <course>` (`telegram/commands/score-records/`) |
| `buildSpecialScoreReport` | `/assat`, `/eaglet`, `/albatrossit` (`telegram/commands/score-records/specialScores.ts`) |

## Data

Owns the `courses`, `scores`, `aces`, `eagles` and `albatrosses` tables (`db/`). Results are saved
once per player and competition, so a retried round end doesn't save twice.

A special score is one row per competition, player and hole (unique key, `hole_number`). New
holes only add rows, and one already saved is left alone. A correction, a removal, or the first
look at a card after a restart replaces the player's rows in the round with the card's, so a
corrected or removed score goes away.

## Files

| File | Does |
| --- | --- |
| `scoreRecords.ts` | Saves special scores per hole and results, finds or adds a course, reads a course's best results. |
| `specialScoreReport.ts` | A chat's special scores of one kind for a period: resolves a course id, a course name (several matches are listed) or a player of the chat, then counts per player and the latest. |
| `policy.ts` | Which hole scores are notable, and which kind each is; the count per player and the latest. |
| `db/` | The `Course` entity, `courseRepository` and `scoreRepository` (raw SQL). |
