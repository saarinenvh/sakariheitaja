import { CityWeather } from "../../integrations/openweather/client";
import { formatClockTime } from "../../shared/utils";

const MS_PER_SECOND = 1000;

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
  const emoji = weatherEmojis[data.weather[0].main] ?? "";
  let msg = `${emoji} ${data.name} <b>${Math.round(data.main.temp * 10) / 10}°C</b> ${emoji}\n`;
  msg += `Tällä hetkellä siis <b>${data.weather[0].description}</b>.\n`;
  msg += `Tuulta puskis <b>${data.wind.speed} m/s</b>.\n`;
  msg += `Aurinko nousee <b>${formatClockTime(new Date(data.sys.sunrise * MS_PER_SECOND))}</b> 🌅\n`;
  msg += `Aurinko laskee <b>${formatClockTime(new Date(data.sys.sunset * MS_PER_SECOND))}</b> 🌇\n`;
  return msg;
}
