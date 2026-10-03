import { getData } from "../../shared/http";
import { parseOrThrow } from "../../shared/validation";
import { CityWeather, cityWeatherSchema, CurrentWeatherResponse, currentWeatherSchema } from "./schema";

export type { CityWeather } from "./schema";

const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const MS_PER_SECOND = 1000;

export interface WeatherLocation {
  latitude: number;
  longitude: number;
}

export interface WeatherObservation {
  observedAt: Date;
  temperatureC: number;
  windSpeedMs: number;
  /** Meteorological: the direction the wind blows from, 0 = north. */
  windFromDeg: number | null;
  description: string;
  precipitationMmPerHour: number | null;
}

export type WeatherResult =
  | { kind: "observed"; observation: WeatherObservation }
  | { kind: "failed"; reason: string };

export interface OpenWeatherClient {
  /** Current conditions at coordinates, for commentary; `failed` without an API key or a usable reply. */
  getCurrentWeather(location: WeatherLocation): Promise<WeatherResult>;
  /** Current conditions in a city by name, or null when OpenWeatherMap doesn't know it or the reply is unusable. */
  getCityWeather(city: string): Promise<CityWeather | null>;
}

export function createOpenWeatherClient(config: { apiKey: string | undefined }): OpenWeatherClient {
  return {
    getCurrentWeather: location => fetchCurrentWeather(location, config.apiKey),
    getCityWeather: async city => {
      const url = `${CURRENT_WEATHER_URL}?q=${city}&units=metric&lang=fi&appid=${config.apiKey}`;
      const result = cityWeatherSchema.safeParse(await getData(url));
      return result.success ? result.data : null;
    },
  };
}

async function fetchCurrentWeather(location: WeatherLocation, apiKey: string | undefined): Promise<WeatherResult> {
  if (!apiKey) return { kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" };

  const input = await getData(buildCurrentWeatherUrl(location, apiKey));
  if (input === undefined) return { kind: "failed", reason: "OpenWeatherMap request failed" };

  let response: CurrentWeatherResponse;
  try {
    response = parseOrThrow(currentWeatherSchema, input, "OpenWeatherMap current weather");
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
  return { kind: "observed", observation: toWeatherObservation(response) };
}

function buildCurrentWeatherUrl(location: WeatherLocation, apiKey: string): string {
  const query = new URLSearchParams({
    lat: String(location.latitude), lon: String(location.longitude), units: "metric", lang: "fi", appid: apiKey,
  });
  return `${CURRENT_WEATHER_URL}?${query.toString()}`;
}

function toWeatherObservation(response: CurrentWeatherResponse): WeatherObservation {
  return {
    observedAt: new Date(response.dt * MS_PER_SECOND),
    temperatureC: response.main.temp,
    windSpeedMs: response.wind.speed,
    windFromDeg: response.wind.deg ?? null,
    description: response.weather[0].description,
    precipitationMmPerHour: sumPrecipitation(response.rain?.["1h"], response.snow?.["1h"]),
  };
}

function sumPrecipitation(rainMm: number | undefined, snowMm: number | undefined): number | null {
  if (rainMm === undefined && snowMm === undefined) return null;
  return (rainMm ?? 0) + (snowMm ?? 0);
}
