# Morning greeting

Every morning at a fixed hour (`GREETING_HOUR` in `morningGreeting.ts`): a good-morning text, a
random town's weather, a call to action and a GIF to `MORNING_CHAT_ID`. Nothing when it is unset.
Each part is sent even if another fails.

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
| `messages.ts` | The greeting text and the call to action. |
| `phrases.ts` | The opening lines and the GIF search words to pick from. |

The weather comes from `../weather-report/`.
