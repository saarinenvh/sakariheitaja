# SakariHeitaja

A Telegram bot that follows and commentates disc golf competitions live from [Disc Golf Metrix](https://discgolfmetrix.com/). When a tracked player finishes a hole, the bot fires off a commentary message in Finnish — praising good scores and mercilessly roasting bad ones.

## Features

- **Live commentary** — polls the Metrix API and sends hole-by-hole commentary as results come in
- **LLM commentary** — commentary, heckling and replies to name mentions use the configured Ollama model with per-purpose prompts in `src/bot/system-prompts/`. Round commentary uses validated facts and the ordered story of previously delivered comments. `LLM_ENABLED=false` uses a deterministic factual fallback
- **Smart polling** — adaptive intervals (30s active → 60s idle → 120s dormant) with exponential backoff on errors
- **Player tracking** — follow specific players per chat group
- **Score history** — query best scores by course name or ID
- **Special scores** — aces, eagles and albatrosses are persisted, including the ones on earlier holes when a player's card is caught up several holes at once
- **Bag tags** — per-chat tag standings
- **Morning greeter** — daily good morning message to `MORNING_CHAT_ID`
- **Weather, GIFs, recipes** — assorted nonsense, see the command list

## Commentary flow

Start reading at `Orchestrator.onPollResult` in
`src/features/disc-golf/orchestrator.ts`. Its steps are:

1. `metrixRound.ts` validates the response and matches tracked players.
2. `roundCommentary.ts` compares scorecards and queues captured updates in order.
3. `factualCommentaryBrief.ts` builds facts; ranking movement uses the last
   successful publication when the queued update is processed.
4. `competitionFacts.ts` captures current same-division opponents and comparable
   score gaps from the same poll. `commentaryWriter.ts` translates internal facts
   into explicit Finnish score descriptions, separate round totals, competition
   facts and the player's own `narrativeHistory`.
5. `commentaryPresentation.ts` keeps the opening, course/hole heading, commentary
   and deterministic result footer. It escapes HTML and splits oversized posts
   into valid Telegram messages.
6. Acknowledged messages advance rankings and append the text actually delivered
   to the story. Each successful fragment counts, even if a later fragment fails.

Only individual Metrix rounds are supported, including training rounds and a
single round selected from a larger event. The adapter accepts missing or empty
`SubCompetitions`, rejects children or a nonzero `HasSubcompetitions`, requires a
nonempty `Tracks` layout, and verifies the requested ID. It does not guess
undocumented `Type` codes. The contract follows the
[Metrix result API](https://discgolfmetrix.com/?u=rule&ID=38).
Layout changes establish a fresh baseline. Short/missing cards stay unavailable;
unknown ranks remain unknown. `PEN` and `OB` normalize to OB counts. Rankings with
previous-round totals are treated conservatively as provisional. The published
ranking survives temporary missing scorecards for the same player.

State belongs to one chat and followed round; narrative history belongs to each
tracked player and resets on identity or division changes. The complete ordered history is supplied without a
six-hole reset or summarization. Its text still consumes model context tokens:
the current request window is 16384 tokens, so long-round context retention and
memory/latency need owner verification with the configured model. Generation
allows up to 350 tokens. The prompt asks for one paragraph of 1–3 short sentences,
or 4–5 for exceptional events; output is not cut by sentence count.
Competition facts include untracked opponents in the same division. Gaps are
withheld for DNF, provisional standings, missing scores or different recorded
hole sets. They describe recorded scores, not predicted final margins.
The commentary prompt loads persona, disc-golf vocabulary/humour inspiration,
then task-specific commentator rules. Imagined throw descriptions are permitted
as comic colour; scores, OB entries and competition claims must match supplied
facts. The shared persona is unchanged; this exception belongs to commentary.

See [implementation findings and the owner test checklist](docs/commentary-findings.md).

State is in memory. Restarting or following again seeds the current scorecard,
with no replay, previous ranking claim, or restored story. Failed sends are
logged and are not retried automatically; ambiguous Telegram timeouts can have
delivered a message without acknowledgment. This change does not add an outbox.
Score writes remain separate from ranking/history acknowledgment; a failed DB
write cannot undo a successful publication.

Monitoring ends once every tracked player has all layout slots recorded and
known final totals, or has DNF status. This does not certify tournament results
as final. Missing API totals can be derived from complete validated cards;
otherwise monitoring continues. DNF players remain eligible for the existing
bag-tag allocation rules. Historical score tables are unchanged. Existing ace,
eagle and albatross rows cannot be reconciled to later corrections because those
tables do not identify the hole; corrections do not insert duplicate awards.

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
| `/lopeta <id>` | Stop following a competition |
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

> `/apua`'s own text is a subset of the above — it predates several of these commands.

## Tech Stack

- **TypeScript 5** — strict mode, CommonJS output
- **grammY** — Telegram bot framework
- **TypeORM + mysql2** — type-safe DB access, parameterized queries
- **MariaDB** — database
- **Ollama** — local LLM for commentary and replies
- **vitest** — 40 tests over scoring, change detection, divisions, commentary, bag tags and the JSON store
- **Docker** — deployed as part of the [sakke-workspace](https://github.com/saarinenvh/sakke-workspace) compose stack

## Layout

```
src/
├── bot/
│   ├── handlers/         # one file per command group
│   └── system-prompts/   # persona, commentator, heckler, asker + context notes
├── features/disc-golf/   # polling, change detection, scoring, divisions, bag tags
├── shared/llm/           # Ollama client
├── scheduler/            # morning greeter
├── db/                   # entities and repositories
└── state/                # runtime state
```

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
the weather. Without it, commentary still gets the public course statistics (historical hole
averages and difficulty) and today's field average; nothing else depends on it. Course data is
fetched once per round and is never allowed to delay commentary. `BOT_COMMENTARY_COUNTRY_CODE`
(default `FI`) is only used to find the course for the weather when there's no integration code.

Blank values are treated as unset. Note that the poll intervals are parsed as
numbers — an empty string would become `NaN` and spin the Metrix poller, so
leave them at their defaults rather than blanking them.

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
```

### Deployment

There is no compose file in this repo on purpose — it duplicated the workspace's
`sakariheitaja` service and drifted from it. Deploy from the workspace:

```bash
s pull
s build sakariheitaja
```

`s build` recreates the container; `s restart` does not re-read `.env`.
