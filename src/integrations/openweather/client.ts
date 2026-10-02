import { Api } from "grammy";
import { z } from "zod";
import { getData } from "../../shared/http";
import { weatherEmojis } from "../../config/phrases";
import { createDate } from "../../shared/utils";
import { weather as MSG } from "../../config/messages";
import { HTML_OPTIONS } from "../../config/bot";
import { parseOrThrow } from "../../shared/validation";
import { readConfig } from "../../config";

interface WeatherResponse {
  cod: string | number;
  name: string;
  main: { temp: number };
  weather: { main: string; description: string }[];
  wind: { speed: number };
  sys: { sunrise: number; sunset: number };
}

export async function sendWeatherMessage(city: string, chatId: number, api: Api): Promise<void> {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=fi&appid=${readConfig().openWeatherMapApiKey}`;
  const response = await getData<WeatherResponse>(url);
  if (!response || !response.weather?.length) {
    await api.sendMessage(chatId, MSG.notFound(city));
    return;
  }
  await api.sendMessage(chatId, _formatWeather(response), HTML_OPTIONS);
}

function _formatWeather(data: WeatherResponse): string {
  const emoji = weatherEmojis[data.weather[0].main] ?? "";
  let msg = `${emoji} ${data.name} <b>${Math.round(data.main.temp * 10) / 10}°C</b> ${emoji}\n`;
  msg += `Tällä hetkellä siis <b>${data.weather[0].description}</b>.\n`;
  msg += `Tuulta puskis <b>${data.wind.speed} m/s</b>.\n`;
  msg += `Aurinko nousee <b>${createDate(data.sys.sunrise)}</b> 🌅\n`;
  msg += `Aurinko laskee <b>${createDate(data.sys.sunset)}</b> 🌇\n`;
  return msg;
}

const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const MS_PER_SECOND = 1000;

const precipitationSchema = z.object({ "1h": z.number().nonnegative().optional() }).optional();
const currentWeatherSchema = z.object({
  dt: z.number().int().positive(),
  main: z.object({ temp: z.number() }),
  wind: z.object({ speed: z.number().nonnegative(), deg: z.number().min(0).max(360).optional() }),
  weather: z.array(z.object({ description: z.string() })).min(1),
  rain: precipitationSchema,
  snow: precipitationSchema,
});

type CurrentWeatherResponse = z.output<typeof currentWeatherSchema>;

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

export async function fetchCurrentWeather(location: WeatherLocation): Promise<WeatherResult> {
  const apiKey = readConfig().openWeatherMapApiKey;
  if (!apiKey) return { kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" };

  const input = await getData<unknown>(buildCurrentWeatherUrl(location, apiKey));
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
