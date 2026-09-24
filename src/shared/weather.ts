import { Api } from "grammy";
import { getData } from "./http";
import { weatherEmojis } from "../config/phrases";
import { createDate } from "./utils";
import { weather as MSG } from "../config/messages";
import { HTML_OPTIONS } from "../config/bot";

interface WeatherResponse {
  cod: string | number;
  name: string;
  main: { temp: number };
  weather: { main: string; description: string }[];
  wind: { speed: number };
  sys: { sunrise: number; sunset: number };
}

export async function sendWeatherMessage(city: string, chatId: number, api: Api): Promise<void> {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=fi&appid=${process.env.OPENWEATHERMAP_APIKEY}`;
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
