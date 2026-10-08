import { ChatMessenger } from "../chatMessenger";
import { OpenWeatherClient } from "../../integrations/openweather/client";
import { GiphyClient } from "../../integrations/giphy/client";
import { buildCityWeatherReport, cities } from "../weather-report";
import { giphySearchWords, randomGoodMorning } from "./phrases";
import { formatMorningGreeting, morningCallToAction } from "./messages";
import { formatClockTime, getRandom } from "../../shared/utils";
import { moduleLogger } from "../../shared/logger";
import { dayInTimeZone } from "../../shared/time";
import { listPlansForDays, PLAN_TIME_ZONE } from "../games";
import { formatGamesPart } from "./gamesPart";

const log = moduleLogger("morning-greeter");

const GREETING_HOUR = 9;
const MS_PER_DAY = 86_400_000;

/** How many days of planned games the greeting lists, today included. */
const GAMES_DAYS = 7;

export interface MorningGreetingDependencies {
  messenger: ChatMessenger;
  openWeather: OpenWeatherClient;
  giphy: GiphyClient;
  /** The group whose game plans the greeting lists; without it, there's no games part. */
  gamesChatId: number | undefined;
}

/**
 * The greeting, a random town's weather, the coming week's planned games, the call to action and a
 * gif; each part is sent even if another fails.
 */
export async function sendMorningGreeting(deps: MorningGreetingDependencies, chatId: number): Promise<void> {
  const { messenger } = deps;
  const greeting = randomGoodMorning[getRandom(randomGoodMorning.length)];
  const message = formatMorningGreeting(greeting, formatClockTime(new Date()));

  try { await messenger.sendHtml(chatId, message); } catch (e: any) { log.error({ err: e }, "morning greeting text failed"); }
  try { await sendCityWeather(deps, chatId, cities[getRandom(cities.length)]); } catch (e: any) { log.error({ err: e }, "morning greeting weather failed"); }
  try { await sendPlannedGames(deps, chatId); } catch (e: any) { log.error({ err: e }, "morning greeting games failed"); }
  try { await messenger.sendText(chatId, morningCallToAction); } catch (e: any) { log.error({ err: e }, "morning greeting call to action failed"); }
  try {
    const gifUrl = await deps.giphy.searchGif(giphySearchWords[getRandom(giphySearchWords.length)]);
    if (gifUrl) await messenger.sendVideo(chatId, gifUrl);
  } catch (e: any) { log.error({ err: e }, "morning greeting gif failed"); }
}

/** Greets `chatId` every day at 09:00; without a chat id there is no greeting. */
export function startMorningGreeter(deps: MorningGreetingDependencies, chatId: number | undefined): void {
  if (chatId === undefined) {
    log.info("MORNING_CHAT_ID not set, skipping morning greeting");
    return;
  }

  const now = new Date();
  let millisTill09 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), GREETING_HOUR, 0, 0, 0).getTime() - now.getTime();
  if (millisTill09 < 0) millisTill09 += MS_PER_DAY;

  log.info({ delayMs: millisTill09 }, "next morning greeting scheduled");

  setTimeout(async () => {
    await sendMorningGreeting(deps, chatId);
    startMorningGreeter(deps, chatId);
  }, millisTill09);
}

/** The planning group's games for the coming week; nothing when there are none, or no group is set. */
async function sendPlannedGames(deps: MorningGreetingDependencies, chatId: number): Promise<void> {
  if (deps.gamesChatId === undefined) return;

  const now = new Date();
  const plans = await listPlansForDays(deps.gamesChatId, GAMES_DAYS, now);
  if (plans.length === 0) return;

  await deps.messenger.sendText(chatId, formatGamesPart(plans, dayInTimeZone(now, PLAN_TIME_ZONE)));
}

async function sendCityWeather(deps: MorningGreetingDependencies, chatId: number, city: string): Promise<void> {
  const report = await buildCityWeatherReport(deps.openWeather, city);
  if (report.kind === "found") await deps.messenger.sendHtml(chatId, report.html);
  else await deps.messenger.sendText(chatId, report.text);
}
