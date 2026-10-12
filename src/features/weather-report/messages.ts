import type { CityWeather } from "../../integrations/openweather/api";
import { clockTimeInTimeZone } from "../../shared/time";
import { escapeHtml } from "../../shared/html";

/** The towns are Finnish, so their sun times are shown in Helsinki time, whatever the container's time zone. */
const WEATHER_TIME_ZONE = "Europe/Helsinki";

/** An emoji per OpenWeatherMap condition group. */
export const weatherEmojis: Record<string, string> = {
  Clouds: "\u{2601}",
  Clear: "\u{2600}",
  Rain: "\u{2614}",
  Snow: "\u{2744}",
  Drizzle: "\u{2614}",
};

export const cityNotFound = (city: string): string => `Mikä vitun ${city}? - Eihän tommosta mestaa oo ees olemassakaa.`;

/** The `/saa` report for a found city. */
export function formatCityWeather(data: CityWeather): string {
  const emoji = weatherEmojis[data.condition] ?? "";
  let msg = `${emoji} ${escapeHtml(data.city)} <b>${Math.round(data.temperatureC * 10) / 10}°C</b> ${emoji}\n`;
  msg += `Tällä hetkellä siis <b>${escapeHtml(data.description)}</b>.\n`;
  msg += `Tuulta puskis <b>${data.windSpeedMs} m/s</b>.\n`;
  msg += `Aurinko nousee <b>${clockTimeInTimeZone(data.sunrise, WEATHER_TIME_ZONE)}</b> 🌅\n`;
  msg += `Aurinko laskee <b>${clockTimeInTimeZone(data.sunset, WEATHER_TIME_ZONE)}</b> 🌇\n`;
  return msg;
}
