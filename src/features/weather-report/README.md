# Weather report

The current weather of a city from OpenWeatherMap (`OpenWeatherClient`), with an emoji per
condition.

## Entry points

| Entry point | Called by |
| --- | --- |
| `buildCityWeatherReport` | `/saa <city>` and `/randomsaa` (`telegram/commands/weather-report/`); the morning greeting |
| `cities` | `/randomsaa` and the morning greeting, to pick a town |

## Data

None.

## Files

| File | Does |
| --- | --- |
| `weatherReport.ts` | Fetches a city's weather and returns the report, or the not-found text. |
| `messages.ts` | The report text, the condition emojis and the not-found text. |
| `phrases.ts` | The Finnish towns to pick from. |
