import { CityWeather, OpenWeatherClient } from "../../integrations/openweather/client";
import { weatherEmojis } from "../../config/phrases";
import { weather as MSG } from "../../config/messages";
import { createDate } from "../../shared/utils";

/** The `/saa` message: `html` for a found city, `text` when OpenWeatherMap doesn't know it. */
export type CityWeatherReport = { kind: "found"; html: string } | { kind: "not-found"; text: string };

export async function buildCityWeatherReport(weather: OpenWeatherClient, city: string): Promise<CityWeatherReport> {
  const report = await weather.getCityWeather(city);
  return report ? { kind: "found", html: formatCityWeather(report) } : { kind: "not-found", text: MSG.notFound(city) };
}

function formatCityWeather(data: CityWeather): string {
  const emoji = weatherEmojis[data.weather[0].main] ?? "";
  let msg = `${emoji} ${data.name} <b>${Math.round(data.main.temp * 10) / 10}°C</b> ${emoji}\n`;
  msg += `Tällä hetkellä siis <b>${data.weather[0].description}</b>.\n`;
  msg += `Tuulta puskis <b>${data.wind.speed} m/s</b>.\n`;
  msg += `Aurinko nousee <b>${createDate(data.sys.sunrise)}</b> 🌅\n`;
  msg += `Aurinko laskee <b>${createDate(data.sys.sunset)}</b> 🌇\n`;
  return msg;
}
