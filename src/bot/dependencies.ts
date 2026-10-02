import { TrackerDependencies } from "../features/live-scoring/scoreTracker";
import { metrixClient } from "../integrations/metrix";
import { openWeather } from "../integrations/openweather";
import { telegramMessenger } from "./messenger";

/** What a followed round talks to; shared by startup and /follow until commands get their dependencies from main.ts. */
export const trackerDependencies: TrackerDependencies = { messenger: telegramMessenger, metrix: metrixClient, openWeather };
