# Games

Game planning: plans for today or days ahead, made with `/hep`, listed with `/hepit`, joined with
`/mukaan`, left with `/pois` and cancelled with `/peru`. The design is in sakke-workspace,
`docs/features/game-planning/README.md`. This is its phase 1: the fixed form only (a day and/or
time first, then the courses). Free text is read by the model in a later phase.

The other small games (`/hyva`, `/kukakirjaa`) need no state and live in their command handler.
The `/kukakirjaa` countdown runs in the background, so it doesn't hold up the bot's other updates;
a failed message is logged and ends it.

## Entry points

| Entry point | Called by |
| --- | --- |
| `makePlan` | `/hep` (`telegram/commands/games/planning.ts`) |
| `listPlans` | `/hepit` |
| `listPlansForDays` | the morning greeting (`../morning-greeting/`), for `GAMES_CHAT_ID`'s next seven days |
| `formatPlanSummary` | `/hepit`, `/hep`'s confirmation and the morning greeting: one plan as a line |
| `joinPlan`, `leavePlan` | `/mukaan`, `/pois` |
| `cancelPlan` | `/peru` |

## Data

Owns two tables (`db/`, migration `CreateGamePlans`). Both are utf8mb4, so plans can hold emoji, with
a collation that ignores case but not accents.

- `game_plans`: a plan in the chat it was made in, with its creator (Telegram id and name), day,
  optional start time, courses (a JSON list) and the text as written. Days and times are Helsinki
  time.
- `game_plan_players`: a plan's players, as free names with the Telegram id when it's known. The
  database keeps each player once per plan: by Telegram id, or by name ignoring case when there's no
  id (through the generated `name_without_id` column), so two `/mukaan`s at the same moment can't
  add the same name twice.

Plans are per chat: commands only see the chat's own plans. A plan's creator isn't necessarily a
player; a fixed-form plan makes its creator the first one. Past plans leave `/hepit` but stay
stored, as the history of who planned to play where.

## Files

| File | Does |
| --- | --- |
| `games.ts` | The service: make, list, join, leave and cancel plans. |
| `fixedForm.ts` | Reads `[day] [klo] [time] courses…` into a day, a time and the courses. |
| `policy.ts` | When a plan's day is allowed (today to 60 days ahead), a player name's longest length (100 characters), and the plans' time zone. |
| `planSummary.ts` | One plan as a line: "la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Wiltzu". |
| `db/` | The `GamePlan` and `GamePlanPlayer` entities and `gamePlanRepository`. |
