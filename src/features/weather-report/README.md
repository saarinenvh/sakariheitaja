# Weather report

The current weather of a city, through the OpenWeatherMap API (`integrations/openweather/api.ts`),
with an emoji per condition.

## Entry points

| Entry point | Called by |
| --- | --- |
| `buildCityWeatherReport` | `/saa <city>` and `/randomsaa` (`telegram/commands/weather-report/`) |
| `formatCityWeather` | the morning greeting, as its weather card |
| `randomTown` | `/randomsaa` and the morning greeting |
| `cities` | the towns `randomTown` picks from |

## Data

None.

## Files

| File | Does |
| --- | --- |
| `weatherReport.ts` | Gets a city's weather and returns the report, or the not-found text (also when OpenWeatherMap can't answer); picks a random town. |
| `messages.ts` | The report text, the condition emojis and the not-found text. |
| `phrases.ts` | The Finnish towns to pick from. |
