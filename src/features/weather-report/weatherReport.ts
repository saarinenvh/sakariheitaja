import { OpenWeatherClient } from "../../integrations/openweather/client";
import { cityNotFound, formatCityWeather } from "./messages";

/** The `/saa` message: `html` for a found city, `text` when OpenWeatherMap doesn't know it. */
export type CityWeatherReport = { kind: "found"; html: string } | { kind: "not-found"; text: string };

export async function buildCityWeatherReport(weather: OpenWeatherClient, city: string): Promise<CityWeatherReport> {
  const report = await weather.getCityWeather(city);
  return report ? { kind: "found", html: formatCityWeather(report) } : { kind: "not-found", text: cityNotFound(city) };
}
