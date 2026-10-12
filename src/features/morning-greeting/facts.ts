import { CityWeather } from "../../integrations/openweather/api";
import { GamePlan } from "../games";
import { dayInTimeZone } from "../../shared/time";
import { GREETING_TIME_ZONE } from "./policy";

/** What the model may say in the greeting; it gets nothing else. */
export interface GreetingFacts {
  weekday: string;
  /** `YYYY-MM-DD`, Helsinki time. */
  date: string;
  /** One of the group's canned lines, for Sakke to build on. */
  mood: string;
  weather: GreetingWeather | null;
  /** Today's games, only how many are coming: the games list with courses and times follows the greeting. */
  todaysGames: { players: number }[];
}

export interface GreetingWeather {
  town: string;
  temperatureC: number;
  windMs: number;
  description: string;
}

export interface GreetingFactsInput {
  now: Date;
  mood: string;
  weather: CityWeather | null;
  todaysPlans: readonly GamePlan[];
}

export function buildGreetingFacts({ now, mood, weather, todaysPlans }: GreetingFactsInput): GreetingFacts {
  return {
    weekday: finnishWeekday(now),
    date: dayInTimeZone(now, GREETING_TIME_ZONE),
    mood: mood.trim(),
    weather: weather ? describeWeather(weather) : null,
    todaysGames: todaysPlans.map(plan => ({ players: plan.players.length })),
  };
}

function finnishWeekday(now: Date): string {
  return new Intl.DateTimeFormat("fi-FI", { weekday: "long", timeZone: GREETING_TIME_ZONE }).format(now);
}

function describeWeather(weather: CityWeather): GreetingWeather {
  return {
    town: weather.city,
    temperatureC: Math.round(weather.temperatureC),
    windMs: Math.round(weather.windSpeedMs),
    description: weather.description,
  };
}
