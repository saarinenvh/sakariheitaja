# Data

Where the bot keeps what it knows. MariaDB holds the history; two JSON files hold the chat
games; everything about a followed round is in memory.

## MariaDB

Each table belongs to one feature, which holds its entity and repository in its `db/` folder.
Tables without an entity are reached with SQL in the repository.

| Table | Owner | Holds |
| --- | --- | --- |
| `players` | `features/players/` | player names, matched to Metrix names; unique, ignoring case (`latin1_swedish_ci`) |
| `player_to_chat` | `features/players/` | which chat tracks which player (`/lisaa`, `/poista`); one row per player and chat |
| `chats` | `features/chats/` | the groups the bot is in |
| `competitions` | `features/live-scoring/` | followed rounds: chat, Metrix id, done |
| `courses` | `features/score-records/` | course names, from rounds and special scores; unique, ignoring case |
| `scores` | `features/score-records/` | final results per player and round (`/tulokset`) |
| `aces`, `eagles`, `albatrosses` | `features/score-records/` | special scores, one row per competition, player and hole (`hole_number`; NULL on rows saved before 2026-10). A corrected hole moves or removes its row. |

`db/dataSource.ts` lists the entities: `Player`, `PlayerChat` (`player_to_chat`), `Chat`,
`Competition`, `Course`, `Score`, and `Ace`, `Eagle`, `Albatross` (one table each, sharing
`SpecialScoreRecord`). BIGINT columns (the chat ids)
read as numbers: the data source sets `supportBigNumbers` and turns `bigNumberStrings` off. The
schema isn't synchronized from the entities. Changes to it are TypeORM migrations in `db/migrations/`, which
run when the bot starts (`migrationsRun`), before anything else uses the database. The bot's DB
user therefore needs `ALTER`, `INDEX` and `CREATE`, the last for TypeORM's `migrations` table.
A failed migration stops the start, and the log says why.

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
| followed rounds per chat | `live-scoring/trackerRegistry.ts` | rebuilt at startup from unfinished competitions |
| each round's snapshot, tracked players, poll timing | `ScoreTracker`, `Poller` | |
| commentary memory: published places, recent messages, welcome flags | `RoundCommentary` | a resumed round starts from the current cards |
| course details and statistics, course location | `RoundCourseData` | fetched once per round |
| the last 10 messages per chat | `heckler/heckler.ts` | heckles and mention answers |
| today's `/hep` plans | `games/games.ts` | cleared when the date changes |
| loaded prompts | `commentaryRuntime`, `heckler/prompts.ts`, `match-play-asker/prompts.ts` | read once from `src/prompts/` |
