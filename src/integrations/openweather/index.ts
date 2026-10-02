import { readConfig } from "../../config";
import { createOpenWeatherClient } from "./client";

/** The bot's OpenWeatherMap client, until commands receive their dependencies from main.ts. */
export const openWeather = createOpenWeatherClient({ apiKey: readConfig().openWeatherMapApiKey });
