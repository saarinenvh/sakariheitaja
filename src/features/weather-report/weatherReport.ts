import { OpenWeatherApi } from "../../integrations/openweather/api";
import { getRandom } from "../../shared/utils";
import { cityNotFound, formatCityWeather } from "./messages";
import { cities } from "./phrases";

/** The `/saa` message: `html` for a found city, `text` when OpenWeatherMap doesn't know it (or can't answer). */
export type CityWeatherReport = { kind: "found"; html: string } | { kind: "not-found"; text: string };

export async function buildCityWeatherReport(weather: OpenWeatherApi, city: string): Promise<CityWeatherReport> {
  const result = await weather.getCityWeather(city);
  return result.kind === "observed"
    ? { kind: "found", html: formatCityWeather(result.weather) }
    : { kind: "not-found", text: cityNotFound(city) };
}

/** One of the Finnish towns, for `/randomsaa` and the morning greeting. */
export function randomTown(): string {
  return cities[getRandom(cities.length)];
}
