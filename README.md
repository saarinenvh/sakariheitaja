# SakariHeitaja

A Telegram bot that follows and commentates disc golf competitions live from [Disc Golf Metrix](https://discgolfmetrix.com/). When a tracked player finishes a hole, the bot fires off a commentary message in Finnish — praising good scores and mercilessly roasting bad ones.

## Features

- **Live commentary** — polls the Metrix API and sends hole-by-hole commentary as results come in
- **LLM commentary** — commentary, heckling and replies to name mentions use the configured Ollama model with per-purpose prompts in `src/prompts/`. Round commentary writes one message per score update from facts computed in code (results, standings, lead history, course and hole facts, weather); `LLM_ENABLED=false` uses a deterministic factual fallback
- **Smart polling** — adaptive intervals (30s active → 60s idle → 120s dormant) with exponential backoff on errors
- **Player tracking** — follow specific players per chat group
- **Score history** — query best scores by course name or ID
- **Special scores** — aces, eagles and albatrosses are persisted, including the ones on earlier holes when a player's card is caught up several holes at once; a corrected hole moves or removes its score, and a restart mid-round misses none
- **Bag tags** — per-chat tag standings
- **Morning greeter** — daily good morning message to `MORNING_CHAT_ID`
- **Weather, GIFs, recipes** — assorted nonsense, see the command list

## Commentary flow

Code computes every fact; the model only writes the message. Start reading at
`ScoreTracker.onPollResult` in `src/features/live-scoring/liveScoring.ts`
([`src/features/live-scoring/README.md`](src/features/live-scoring/README.md)):

1. `MetrixClient.getRound` (`src/integrations/metrix/`) fetches the round and
   normalizes it; `trackRoundPlayers` matches the chat's players. Metrix reports
   ties and early-round places as 0 or not at all; those players get a shared place
   derived from recorded totals. What Metrix sends and how each field is normalized
   is in [`src/integrations/metrix/README.md`](src/integrations/metrix/README.md).
2. `commentary/` turns the changes into one message per division, stage by stage
   ([`src/features/commentary/README.md`](src/features/commentary/README.md)):
   - `detect/`: what changed since the last poll and the last delivered message
   - `facts/`: everything the model may say, computed in code
   - `write/`: compact JSON facts and the three latest messages go to Ollama with a
     JSON response schema (an opening, one line per player, a closing; player names
     are an enum). Unusable replies, errors and timeouts fall back to factual lines.
   - `format/`: the Telegram message, with a deterministic result row per player
3. Only acknowledged sends advance rankings and the recent-message history.

The prompt is `src/prompts/batch_commentator.md`. The model may invent
throw imagery as comic colour; results, OB entries, places and gaps must match the
facts. A code-derived `firstMessage` flag marks each division's first delivered
message, so the opening welcomes the audience even when following starts mid-round.

Course and hole facts are optional enrichment. Each part is present only when
Metrix has it: layout data needs `BOT_METRIX_INTEGRATION_CODE` (see Environment
variables), the course statistics are read from the public course page, and today's
field average comes from the round itself. Course data is fetched once per round
with timeouts; a failure, a hang or data that can't be composed drops those facts,
never the message. Weather is fetched at the first update and rechecked once past
halfway; a change is reported only when it's significant.

Only individual Metrix rounds are supported, including training rounds and a
single round selected from a larger event. The adapter accepts missing or empty
`SubCompetitions`, rejects children or a nonzero `HasSubcompetitions`, requires a
nonempty `Tracks` layout, and verifies the requested ID. It does not guess
undocumented `Type` codes. The contract follows the
[Metrix result API](https://discgolfmetrix.com/?u=rule&ID=38).
Layout changes establish a fresh baseline. Short/missing cards stay unavailable.
`PEN` and `OB` normalize to OB counts. Rankings with previous-round totals are
treated conservatively as provisional. The published ranking survives temporary
missing scorecards for the same player.

State belongs to one chat and followed round, and is in memory. Restarting or
following again seeds the current scorecard, with no replay or previous ranking
claim. Failed sends are logged and not retried automatically; ambiguous Telegram
timeouts can have delivered a message without acknowledgment. Score writes remain
separate from ranking/history acknowledgment; a failed DB write cannot undo a
successful publication.

Monitoring ends once every tracked player has all layout slots recorded and
known final totals, or has DNF status. This does not certify tournament results
as final. Missing API totals can be derived from complete validated cards;
otherwise monitoring continues. DNF players remain eligible for the existing
bag-tag allocation rules. Historical score tables are unchanged. Corrections
rebuild a player's special-score rows for that competition from the current card;
they do not insert duplicate awards.

See [implementation findings and the owner test checklist](docs/commentary-findings.md),
and the commentary eval harness below for prompt and model work.

## Local Ollama diagnostics

Set `BOT_OLLAMA_TRACE=true` in the standalone bot's environment and restart it.
Every Ollama HTTP call writes a readable JSON file under `logs/ollama/`, relative
to the bot's working directory. A pending record is written before the request,
then updated with the full response, timestamps and HTTP status or transport
error type. Requests include the exact model, options, system prompt and user
content (including factual brief and full narrative history for commentary).
Responses retain provider fields such as `prompt_eval_count`, `eval_count` and
`done_reason` when supplied, before output cleanup. These counts alone do not
prove whether the provider truncated context.

Tracing is disabled by default and covers all bot Ollama calls, not only
commentary. Files contain private names and conversation text; do not publish
them unredacted. `logs/` is Git-ignored; new files use owner-only permissions.
Disable tracing after testing and delete the files when no longer needed.
There is no automatic retention limit. Logging failures warn without stopping
inference. No credentials, environment dump or endpoint URL are added to traces.

## Commentary eval harness

A dev tool for prompt and model work. It replays real Metrix rounds hole by hole through
the real `RoundCommentary` and batch writer against a real Ollama, checks every message,
and writes a readable report. Only Telegram, the database and the weather API are faked.
It is not part of `npm test` or CI, because it calls a live model.

```bash
# Turn a public Metrix round into an anonymized fixture (every player name replaced);
# with the integration code it also stores the course layout data, otherwise only the statistics
BOT_METRIX_INTEGRATION_CODE=... npm run eval:commentary:fixture -- --round=3628927 --track="Name A,Name B" --name=my-round

# Replay all fixtures; each invocation writes .eval-results/runN/ (Git-ignored)
# with report.md, results.json and prompt.md (the exact prompt used)
npm run eval:commentary -- --model=gemma4:26b-a4b-q3 --baseUrl=http://<ollama-host>:11434

# Faster iteration: some holes, several runs, one fixture, a prompt variant
npm run eval:commentary -- --model=... --holes=1-6 --runs=3 --fixture=my-round --prompt=/tmp/variant.md
```

- Fixtures live in `scripts/eval-commentary/fixtures/`. The same real first name maps to the
  same fake first name, so first-name collisions survive. The round ID is not stored.
  Each fixture has an editable start and halfway weather, so the weather change is exercised.
- The replay assumes everyone plays in hole order. Places come from the bot's own derivation
  from recorded totals, as when Metrix reports place 0.
- Checks separate failures (fallback, invented OB, wrong hole number, ball-golf verbs) from
  heuristic warnings (sentence limits, unsupported movement words, water imagery, more than
  one `kuin` comparison) and info (player name missing). Language and humour still need a
  human read of the report.
- `--holes` only calls the model for those holes; the others publish the factual fallback,
  so they don't add to the recent-message history.
- `results.json` keeps the full results, and `prompt.md` the exact prompt, for comparing a
  prompt change against a baseline run. Rejected model replies are kept with fallbacks.
- `npm run typecheck:eval` type-checks the harness, which `npx tsc --noEmit` doesn't cover.

## Commands

### Competition
| Command | Description |
|---|---|
| `/follow <metrixId>` | Start following a competition |
| `/lopeta <metrixId>` | Stop following a competition |
| `/pelit` | List active competitions |
| `/top5 <id>` | Show top 5 results by division |
| `/score <name>` | Show a player's current score and position |

### Players
| Command | Description |
|---|---|
| `/lisaa <name>` | Add a player to tracked players |
| `/poista <name>` | Remove a player from tracked players |
| `/pelaajat` | List tracked players |

### Scores
| Command | Description |
|---|---|
| `/tulokset <course>` | Show top 10 scores for a course (name or ID) |
| `/assat`, `/eaglet`, `/albatrossit` `[alltime] [course id, course or player]` | This year's aces, eagles or albatrosses in the chat: count per player and the 5 latest. `alltime` covers every year. A course name matching several courses lists them with their ids. |

### Bag tags
| Command | Description |
|---|---|
| `/bagtag` | Show the current bag tag standings |
| `/bagtag set <name> <number>` | Assign a tag to a player |
| `/bagtag remove <name>` | Remove a player's tag |

### Weather
| Command | Description |
|---|---|
| `/saa <city>` | Current weather for a city (OpenWeatherMap) |
| `/randomsaa` | The same, for a random city from the configured list |

### Fun
| Command | Description |
|---|---|
| `/hep <text>` | Announce you're playing today |
| `/pelei` | List today's game plans |
| `/kukakirjaa <names...>` | Randomly pick who keeps score |
| `/hyva` | You know what this does |
| `/isit` | Hyvä isit! |
| `/gifplz <term>` | Send a random matching GIF from Giphy |
| `/mitatanaansyotaisiin` | A random Finnish recipe from the S-cloud API |
| `/apua` | Show the in-bot command list |

### Dev
Only registered when `LLM_ENABLED=true`:

| Command | Description |
|---|---|
| `/heckle [message]` | Force an LLM heckler response from the chat's message buffer |
| `/aamuu` | Send the morning greeting on demand |
| `/virheet` | List the followed rounds that were given up on (`error`), in every chat |

`/apua` is generated from the command definitions (`src/telegram/commands/*/command.ts`), so it
lists every command above except `/isit`, `/heckle`, `/aamuu`, `/virheet` and itself.

## Tech Stack

- **TypeScript 5** — strict mode, CommonJS output
- **grammY** — Telegram bot framework
- **TypeORM + mysql2** — type-safe DB access, parameterized queries
- **MariaDB** — database
- **Ollama** — local LLM for commentary and replies
- **vitest** — unit tests in each module's `tests/` folder; integration tests against a real MariaDB (Testcontainers) in `src/tests/integration/`
- **Docker** — deployed as part of the [sakke-workspace](https://github.com/saarinenvh/sakke-workspace) compose stack

## Layout

The layers, their import rules and every entry point are in
[`docs/architecture/`](docs/architecture/README.md), with the live-scoring flow and where data
is stored.

```
src/
├── main.ts                  # composition root: config, clients, commands, resumed rounds, the bot
├── config.ts                # the only reader of environment variables
├── telegram/                # grammY: the bot, the messenger, chat tracking
│   └── commands/<feature>/  # command.ts (names, /apua help) and its handler; registry.ts registers them all
├── features/                # one folder per capability, each with a README
│   ├── live-scoring/        # following a round: tracker, poller, course data, round end
│   ├── commentary/          # detect → facts → write → format
│   ├── bagtags/  player-profiles/  score-records/  players/  chats/  games/
│   ├── match-play-asker/  heckler/  morning-greeting/  weather-report/  recipes/
│   └── chatMessenger.ts     # how features send to a chat
├── integrations/            # one client per external system: metrix (see its README),
│                            # openweather, ollama, challonge, giphy, recipes
├── db/                      # the database connection and its entity list
├── shared/                  # http, logger, validation, JSON stores, HTML escaping
├── prompts/                 # the model prompts and context notes
└── data/                    # fallback copies of the JSON stores (production uses DATA_DIR)
scripts/eval-commentary/     # commentary eval harness and its fixtures
docs/architecture/           # layers, entry points, live-scoring flow, data
```

Each table belongs to one feature, which holds its entity and repository
([`docs/architecture/data.md`](docs/architecture/data.md)).

## Setup

### Environment variables

The deployed values live in `sakke-workspace/.env`, and `sakke-workspace/.env.example`
is the documented source of truth — the compose file passes each name through
explicitly, so a variable that isn't listed there isn't reaching the container.

For running the bot on its own:

```
TOKEN=your_telegram_bot_token
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=sakariheitaja

LLM_ENABLED=true
OLLAMA_BASE_URL=http://host.docker.internal:11434
BOT_OLLAMA_MODEL=gemma3:12b
BOT_OLLAMA_TIMEOUT_MS=120000

MORNING_CHAT_ID=
GIPHY_API_KEY=
OPENWEATHERMAP_APIKEY=
BOT_METRIX_INTEGRATION_CODE=
BOT_COMMENTARY_COUNTRY_CODE=FI
CHALLONGE_TOURNAMENT_URL=
CHALLONGE_API_KEY=

POLL_INTERVAL_ACTIVE=30000
POLL_INTERVAL_IDLE=60000
POLL_INTERVAL_DORMANT=120000
```

`BOT_METRIX_INTEGRATION_CODE` is the personal integration code from Metrix user preferences.
With it, commentary gets each hole's par, length and wind relative to the throwing direction,
the course's par-rating difficulty, round ratings at the finish, and exact course coordinates for
the weather. Every finished round's rating is shown in its result row and in the TOP-5 list. Only
exceptional ratings reach the model: 1000 or more, 980–999, and below 750; code keeps the rest out
of its input. Without it, commentary still gets the public course statistics (historical hole
averages and difficulty) and today's field average; nothing else depends on it. Course data is
fetched once per round and is never allowed to delay commentary. `BOT_COMMENTARY_COUNTRY_CODE`
(default `FI`) is only used to find the course for the weather when there's no integration code.

`src/config.ts` is the only code that reads the environment. Blank values are
treated as unset, so a blank poll interval uses its default. A value that can't be
used (a poll interval, timeout or port that isn't a positive integer) stops the bot
at startup with an error naming the variable.

Logs use pino with pino-pretty, in the same format as sakke-gateway: the time, the
level and `[module] message`, followed by the event's fields (`metrixId`, `err`, …).
Each module gets its logger from `moduleLogger(name)` in `src/shared/logger.ts`.
Tests log nothing.

### Run locally

```bash
npm install
npm run dev              # or: npm run dev:local, which reads .env.dev
```

### Build & run

```bash
npm run build
npm start
```

### Test

```bash
npm test                 # vitest run
npm run test:watch
npm run test:integration # needs Docker and Node 24 (.nvmrc)
```

The integration tests start a throwaway MariaDB 11 in Docker with Testcontainers. They create the
tables as prod had them before the bot had migrations (`src/tests/integration/fixtures/prodSchema.sql`),
initialise the bot's own data source, which runs every migration, then call the real repositories
and features. Each test file gets a fresh database. CI runs them as their own job.

**Write one when a change depends on how MariaDB behaves:** a migration, a unique key, a
collation, a transaction, or how a column type comes back. The unit tests mock the database, so
they can't catch those.

### Deployment

There is no compose file in this repo on purpose — it duplicated the workspace's
`sakariheitaja` service and drifted from it. Deploy from the workspace:

```bash
s pull
s build sakariheitaja
```

`s build` recreates the container; `s restart` does not re-read `.env`.
