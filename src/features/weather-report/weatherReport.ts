import { CityWeather, OpenWeatherClient } from "../../integrations/openweather/client";
import { cityNotFound, weatherEmojis } from "./phrases";
import { formatClockTime } from "../../shared/utils";

const MS_PER_SECOND = 1000;

/** The `/saa` message: `html` for a found city, `text` when OpenWeatherMap doesn't know it. */
export type CityWeatherReport = { kind: "found"; html: string } | { kind: "not-found"; text: string };

export async function buildCityWeatherReport(weather: OpenWeatherClient, city: string): Promise<CityWeatherReport> {
  const report = await weather.getCityWeather(city);
  return report ? { kind: "found", html: formatCityWeather(report) } : { kind: "not-found", text: cityNotFound(city) };
}

function formatCityWeather(data: CityWeather): string {
  const emoji = weatherEmojis[data.weather[0].main] ?? "";
  let msg = `${emoji} ${data.name} <b>${Math.round(data.main.temp * 10) / 10}°C</b> ${emoji}\n`;
  msg += `Tällä hetkellä siis <b>${data.weather[0].description}</b>.\n`;
  msg += `Tuulta puskis <b>${data.wind.speed} m/s</b>.\n`;
  msg += `Aurinko nousee <b>${formatClockTime(new Date(data.sys.sunrise * MS_PER_SECOND))}</b> 🌅\n`;
  msg += `Aurinko laskee <b>${formatClockTime(new Date(data.sys.sunset * MS_PER_SECOND))}</b> 🌇\n`;
  return msg;
}
