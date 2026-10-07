# Games

Who is playing today: `/hep <text>` announces a plan, `/pelei` lists them. The other small games
(`/hyva`, `/kukakirjaa`) need no state and live in their command handler. The `/kukakirjaa`
countdown runs in the background, so it doesn't hold up the bot's other updates; a failed message
is logged and ends it.

## Entry points

| Entry point | Called by |
| --- | --- |
| `announcePlan`, `todaysPlans` | `/hep`, `/pelei` (`telegram/commands/games/`) |

## Data

In memory only: one plan per user, cleared when the date changes.

## Files

| File | Does |
| --- | --- |
| `games.ts` | Today's plans. |
