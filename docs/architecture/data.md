# Data

Where the bot keeps what it knows. MariaDB holds the history; two JSON files hold the chat
games; everything about a followed round is in memory.

## MariaDB

Each table belongs to one feature, which holds its entity and repository in its `db/` folder.
Every table has a TypeORM entity, and the repositories use TypeORM's queries; SQL is written only
in the migrations.

| Table | Owner | Holds |
| --- | --- | --- |
| `players` | `features/players/` | player names, matched to Metrix names; unique, ignoring case (`latin1_swedish_ci`) |
| `player_to_chat` | `features/players/` | which chat tracks which player (`/lisaa`, `/poista`); one row per player and chat |
| `chats` | `features/chats/` | the groups the bot is in |
| `competitions` | `features/live-scoring/` | followed rounds: chat, Metrix id, `status` (`following`, `finished`, `error` or `stopped`), and the round's `day` from Metrix (NULL on rounds followed before 2026-10). A round in `error` keeps `errored_at` and `error_reason` for manual handling. `/lopeta` marks a round `stopped`, keeping its row and special scores; only `following` rounds are resumed. |
| `courses` | `features/score-records/` | course names, from rounds and special scores; unique, ignoring case |
| `scores` | `features/score-records/` | final results per player and round (`/tulokset`) |
| `aces`, `eagles`, `albatrosses` | `features/score-records/` | special scores, one row per competition, player and hole (`hole_number`; NULL on rows saved before 2026-10). Live scoring syncs a followed round's rows to each tracked player's card on every poll, so a corrected hole moves or removes its row; other rounds' rows are never touched. |
| `game_plans` | `features/games/` | planned games (`/hep`): chat, creator (Telegram id and name), day, optional start time, courses (JSON list), the text as written. utf8mb4. Past plans stay as history. |
| `game_plan_players` | `features/games/` | a plan's players: a name, with the Telegram id when known. Unique per plan by Telegram id, or by name ignoring case when there's no id (generated `name_without_id`). utf8mb4. |

`db/dataSource.ts` lists the entities: `Player`, `PlayerChat` (`player_to_chat`), `Chat`,
`Competition`, `Course`, `Score`, `Ace`, `Eagle`, `Albatross` (one table each, sharing
`SpecialScoreRecord`), `GamePlan` and `GamePlanPlayer`. BIGINT columns (the chat ids)
read as numbers: the data source sets `supportBigNumbers` and turns `bigNumberStrings` off. The
schema isn't synchronized from the entities. Changes to it are TypeORM migrations in `db/migrations/`, which
run when the bot starts (`migrationsRun`), before anything else uses the database. The bot's DB
user therefore needs `ALTER`, `INDEX` and `CREATE`, the last for TypeORM's `migrations` table.
A failed migration stops the start, and the log says why.

### When a write fails

Who retries a failed write depends on whether someone is waiting for it:

- **Background writes** go through `withWriteRetry` (`db/writeRetry.ts`): live scoring's special
  scores, the round's day, the round end's course, results and status, a resumed round's `error`
  mark, and each chat's nightly pinned-list refresh. Nobody would notice them fail, so they retry
  themselves: up to five attempts over
  about 15 seconds, on a transient error only (a deadlock, a lock wait timeout, a lost or refused
  connection). Any other error fails at once.
- **Command writes** (`/follow`, `/hep`, `/lisaa` and the rest) aren't retried. The command
  replies with the error, and the user is the retry.

A retried write must be safe to repeat, since a failed attempt may still have committed. Retry
the whole operation, never one statement of a transaction: a deadlock rolls the whole
transaction back. `saveResults`, for example, is safe to repeat as a whole because it skips the
players already saved, while its single insert isn't. A write that isn't safe to repeat, such as
the `competitions` insert on `/follow`, can't be made a background write until it is.

## JSON stores

Written with `shared/jsonStore.ts` (atomic replace, cached; this process is the only writer).

| File | Owner | Holds |
| --- | --- | --- |
| `bagtags.json` | `features/bagtags/` | the tag number of each player, per chat |
| `player_profiles.json` | `features/player-profiles/` | per-player form (games played, average place, hot/cold), updated at each round end |

Both live in `DATA_DIR`. Without it they fall back to `src/data/` (`dist/data/` when built),
which only suits local runs: a container rebuild loses it. The copies in the repo are test data.
Profiles are written but not yet read by anything. Where these two belong for good is ticket
EfY0S63X.

## In memory

Lost on restart, by design.

| State | Where | Notes |
| --- | --- | --- |
| followed rounds per chat | `live-scoring/trackerRegistry.ts` | rebuilt at startup from the competitions still `following`; also holds the rounds a `/follow` is starting |
| each round's snapshot, tracked players, poll timing | `ScoreTracker`, `Poller` | |
| commentary memory: published places, recent messages, welcome flags | `RoundCommentary` | a resumed round starts from the current cards |
| course details and statistics, course location | `RoundCourseData` | fetched once per round |
| the last 10 messages per chat | `heckler/heckler.ts` | heckles and mention answers |
| loaded prompts | `commentaryRuntime`, `heckler/prompts.ts`, `match-play-asker/prompts.ts` | read once from `src/prompts/` |
