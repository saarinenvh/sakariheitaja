# Data

Where the bot keeps what it knows. MariaDB holds the history; two JSON files hold the chat
games; everything about a followed round is in memory.

## MariaDB

Each table belongs to one feature, which holds its entity and repository in its `db/` folder.
Tables without an entity are reached with SQL in the repository.

| Table | Owner | Holds |
| --- | --- | --- |
| `players` | `features/players/` | player names, matched to Metrix names |
| `player_to_chat` | `features/players/` | which chat tracks which player (`/lisaa`, `/poista`) |
| `chats` | `features/chats/` | the groups the bot is in |
| `competitions` | `features/live-scoring/` | followed rounds: chat, Metrix id, done |
| `courses` | `features/score-records/` | course names from finished rounds |
| `scores` | `features/score-records/` | final results per player and round (`/tulokset`) |
| `aces`, `eagles`, `albatrosses` | `features/score-records/` | special scores, saved with the commentary message that reports them |

`db/dataSource.ts` lists the entities: `Player`, `Chat`, `Competition`, `Course`. The schema
isn't synchronized from them; the tables already exist.

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
