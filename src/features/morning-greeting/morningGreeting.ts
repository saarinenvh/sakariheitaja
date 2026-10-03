import { ChatMessenger } from "../chatMessenger";
import { OpenWeatherClient } from "../../integrations/openweather/client";
import { GiphyClient } from "../../integrations/giphy/client";
import { buildCityWeatherReport } from "../weather-report/weatherReport";
import { cities } from "../weather-report/phrases";
import { giphySearchWords, randomGoodMorning } from "./phrases";
import { formatMorningGreeting, morningCallToAction } from "./messages";
import { formatClockTime, getRandom } from "../../shared/utils";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("morning-greeter");

const GREETING_HOUR = 9;
const MS_PER_DAY = 86_400_000;

export interface MorningGreetingDependencies {
  messenger: ChatMessenger;
  openWeather: OpenWeatherClient;
  giphy: GiphyClient;
}

/** The greeting, a random town's weather, the call to action and a gif; each part is sent even if another fails. */
export async function sendMorningGreeting(deps: MorningGreetingDependencies, chatId: number): Promise<void> {
  const { messenger } = deps;
  const greeting = randomGoodMorning[getRandom(randomGoodMorning.length)];
  const message = formatMorningGreeting(greeting, formatClockTime(new Date()));

  try { await messenger.sendHtml(chatId, message); } catch (e: any) { log.error({ err: e }, "morning greeting text failed"); }
  try { await sendCityWeather(deps, chatId, cities[getRandom(cities.length)]); } catch (e: any) { log.error({ err: e }, "morning greeting weather failed"); }
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

async function sendCityWeather(deps: MorningGreetingDependencies, chatId: number, city: string): Promise<void> {
  const report = await buildCityWeatherReport(deps.openWeather, city);
  if (report.kind === "found") await deps.messenger.sendHtml(chatId, report.html);
  else await deps.messenger.sendText(chatId, report.text);
}
