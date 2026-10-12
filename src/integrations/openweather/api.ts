import { parseOrThrow } from "../../shared/validation";
import { OpenWeatherClient } from "./client";
import { cityWeatherSchema, CityWeatherResponse, CurrentWeatherResponse, currentWeatherSchema } from "./schema";

// The OpenWeatherMap endpoints the bot uses, through the client: each builds its request, parses the
// reply with schema.ts and returns the bot's own type. Features use this, never the client.

const CURRENT_WEATHER_PATH = "/weather";
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

/** Current conditions in a city, as `/saa` and the morning greeting show them. */
export interface CityWeather {
  city: string;
  temperatureC: number;
  windSpeedMs: number;
  description: string;
  /** OpenWeatherMap's condition group ("Clouds", "Rain", …), for the report's emoji. */
  condition: string;
  sunrise: Date;
  sunset: Date;
}

/** `failed` also when OpenWeatherMap doesn't know the city: its reply then isn't a weather report. */
export type CityWeatherResult =
  | { kind: "observed"; weather: CityWeather }
  | { kind: "failed"; reason: string };

export interface OpenWeatherApi {
  /** Current conditions at coordinates, for commentary; `failed` without an API key or a usable reply. */
  getCurrentWeather(location: WeatherLocation): Promise<WeatherResult>;
  /** Current conditions in a city by name; `failed` without an API key, an unknown city, or an unusable reply. */
  getCityWeather(city: string): Promise<CityWeatherResult>;
}

export function createOpenWeatherApi(client: OpenWeatherClient): OpenWeatherApi {
  return {
    getCurrentWeather: location => getCurrentWeather(client, location),
    getCityWeather: city => getCityWeather(client, city),
  };
}

async function getCurrentWeather(client: OpenWeatherClient, location: WeatherLocation): Promise<WeatherResult> {
  const response = await client.get(CURRENT_WEATHER_PATH, { lat: String(location.latitude), lon: String(location.longitude) });
  if (response.kind === "failed") return response;

  let parsed: CurrentWeatherResponse;
  try {
    parsed = parseOrThrow(currentWeatherSchema, response.body, "OpenWeatherMap current weather");
  } catch (error) {
    return { kind: "failed", reason: errorReason(error) };
  }

  return { kind: "observed", observation: toWeatherObservation(parsed) };
}

async function getCityWeather(client: OpenWeatherClient, city: string): Promise<CityWeatherResult> {
  const response = await client.get(CURRENT_WEATHER_PATH, { q: city });
  if (response.kind === "failed") return response;

  let parsed: CityWeatherResponse;
  try {
    parsed = parseOrThrow(cityWeatherSchema, response.body, "OpenWeatherMap city weather");
  } catch (error) {
    return { kind: "failed", reason: errorReason(error) };
  }

  return { kind: "observed", weather: toCityWeather(parsed) };
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

function toCityWeather(response: CityWeatherResponse): CityWeather {
  return {
    city: response.name,
    temperatureC: response.main.temp,
    windSpeedMs: response.wind.speed,
    description: response.weather[0].description,
    condition: response.weather[0].main,
    sunrise: new Date(response.sys.sunrise * MS_PER_SECOND),
    sunset: new Date(response.sys.sunset * MS_PER_SECOND),
  };
}

function sumPrecipitation(rainMm: number | undefined, snowMm: number | undefined): number | null {
  if (rainMm === undefined && snowMm === undefined) return null;
  return (rainMm ?? 0) + (snowMm ?? 0);
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
