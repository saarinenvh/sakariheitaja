import { CityWeather } from "../../integrations/openweather/api";
import { GamePlan } from "../games";
import { dayInTimeZone } from "../../shared/time";
import { GREETING_TIME_ZONE } from "./policy";

/** What the model may say in the greeting; it gets nothing else. */
export interface GreetingFacts {
  weekday: string;
  /** `YYYY-MM-DD`, Helsinki time. */
  date: string;
  weather: GreetingWeather | null;
  /** Today's games, only how many are coming: the games list with courses and times follows the greeting. */
  todaysGames: { players: number }[];
  /** Sakke's last greetings in this chat, newest first, so the new one opens and jokes differently. */
  recentGreetings: string[];
}

export interface GreetingWeather {
  town: string;
  temperatureC: number;
  windMs: number;
  description: string;
}

export interface GreetingFactsInput {
  now: Date;
  weather: CityWeather | null;
  todaysPlans: readonly GamePlan[];
  recentGreetings: readonly string[];
}

export function buildGreetingFacts({ now, weather, todaysPlans, recentGreetings }: GreetingFactsInput): GreetingFacts {
  return {
    weekday: finnishWeekday(now),
    date: dayInTimeZone(now, GREETING_TIME_ZONE),
    weather: weather ? describeWeather(weather) : null,
    todaysGames: todaysPlans.map(plan => ({ players: plan.players.length })),
    recentGreetings: [...recentGreetings],
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
