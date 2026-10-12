import { CityWeather } from "../../integrations/openweather/api";

// Typed weather for tests across modules, with valid defaults: a test spells out only what it is about.

/** Cloudy Helsinki at +9.2 °C, wind 3.1 m/s; sunrise 07:40 and sunset 18:20 Helsinki time on 2026-10-10. */
export function buildCityWeather(overrides: Partial<CityWeather> = {}): CityWeather {
  return {
    city: "Helsinki", temperatureC: 9.2, windSpeedMs: 3.1, description: "pilvistä", condition: "Clouds",
    sunrise: new Date("2026-10-10T04:40:00Z"), sunset: new Date("2026-10-10T15:20:00Z"),
    ...overrides,
  };
}
