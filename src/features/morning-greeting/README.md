# Morning greeting

Every morning at a fixed hour (`GREETING_HOUR` in `morningGreeting.ts`): a good-morning text, a
random town's weather, the coming week's planned games, a call to action and a GIF to
`MORNING_CHAT_ID`. Nothing when it is unset. Each part is sent even if another fails.

The games part lists the plans (`../games/`) of `GAMES_CHAT_ID`, the planning group, for today and
the next six days: "Tänään pelataan" and "Tulossa", then an invitation to join in SakariPelit. It's
left out when `GAMES_CHAT_ID` is unset or nothing is planned. This is the one place a plan is read
outside the chat it was made in.

## Entry points

| Entry point | Called by |
| --- | --- |
| `startMorningGreeter` | `main.ts` at startup |
| `sendMorningGreeting` | `/aamuu` (`telegram/commands/dev/`), on demand |

## Data

None.

## Files

| File | Does |
| --- | --- |
| `morningGreeting.ts` | The daily timer and the greeting's parts. |
| `gamesPart.ts` | The games part's text, from the plans and today's date. |
| `messages.ts` | The greeting text, the call to action and the games invitation. |
| `phrases.ts` | The opening lines and the GIF search words to pick from. |

The weather comes from `../weather-report/`.
