import { ChatMessenger } from "../chatMessenger";
import { CityWeather, OpenWeatherApi } from "../../integrations/openweather/api";
import { GiphyClient } from "../../integrations/giphy/client";
import { OllamaClient } from "../../integrations/ollama/client";
import { formatCityWeather, randomTown } from "../weather-report";
import { GifSearchWord, giphySearchWords, randomGoodMorning } from "./phrases";
import { formatFallbackGreeting } from "./messages";
import { getRandom } from "../../shared/utils";
import { moduleLogger } from "../../shared/logger";
import { clockTimeInTimeZone, dayInTimeZone } from "../../shared/time";
import { GamePlan, listPlansForDays, PLAN_TIME_ZONE } from "../games";
import { formatGamesPart } from "./gamesPart";
import { GREETING_TIME_ZONE, msUntilNextGreeting } from "./policy";
import { buildGreetingFacts } from "./facts";
import { GreetingResult, writeGreeting } from "./greetingWriter";
import * as greetingRepo from "./db/morningGreetingRepository";
import { withWriteRetry } from "../../db/writeRetry";

const log = moduleLogger("morning-greeter");

/** How many days of planned games the greeting lists, today included. */
const GAMES_DAYS = 7;

/** How many of Sakke's last greetings the model sees: about a working week. */
const RECENT_GREETINGS = 5;

export interface MorningGreetingDependencies {
  messenger: ChatMessenger;
  openWeather: OpenWeatherApi;
  giphy: GiphyClient;
  ollama: OllamaClient;
  llmEnabled: boolean;
  /** The group whose game plans the greeting lists; without it, there's no games part. */
  gamesChatId: number | undefined;
}

/** What the greeting is written from; a part that can't be read is left out. */
interface GreetingInputs {
  now: Date;
  weather: CityWeather | null;
  /** The planning group's games for the coming week. */
  plans: GamePlan[];
  /** Sakke's last greetings in this chat, newest first. */
  recentGreetings: string[];
}

/**
 * Sakke's greeting, written by the model from the day's facts (or the canned greeting when it can't
 * be), then the weather card, the coming week's games and a gif; each part is sent even if another
 * fails. Sakke's own greeting is saved last, so a slow database never holds back the other parts.
 */
export async function sendMorningGreeting(deps: MorningGreetingDependencies, chatId: number): Promise<void> {
  const inputs = await gatherInputs(deps, chatId);

  const facts = buildGreetingFacts({ ...inputs, todaysPlans: todaysPlans(inputs) });
  const greeting = await writeGreeting(deps.ollama, facts, deps.llmEnabled);

  const textSent = await sendPart("text", () => sendGreetingText(deps, chatId, greeting, inputs));
  await sendPart("weather", () => sendWeather(deps, chatId, inputs));
  await sendPart("games", () => sendPlannedGames(deps, chatId, inputs));
  await sendPart("gif", () => sendGif(deps, chatId, gifWord(greeting)));

  if (greeting.kind === "generated" && textSent) await saveGreeting(chatId, greeting.reply.text);
}

/** Greets `chatId` every day at 09:00; without a chat id there is no greeting. */
export function startMorningGreeter(deps: MorningGreetingDependencies, chatId: number | undefined): void {
  if (chatId === undefined) {
    log.info("MORNING_CHAT_ID not set, skipping morning greeting");
    return;
  }

  const delayMs = msUntilNextGreeting(new Date());
  log.info({ delayMs }, "next morning greeting scheduled");

  setTimeout(async () => {
    try {
      await sendMorningGreeting(deps, chatId);
    } catch (error) {
      log.error({ err: error }, "morning greeting failed");
    } finally {
      startMorningGreeter(deps, chatId);
    }
  }, delayMs);
}

async function gatherInputs(deps: MorningGreetingDependencies, chatId: number): Promise<GreetingInputs> {
  const now = new Date();

  const [weather, plans, recentGreetings] = await Promise.all([
    fetchWeather(deps), fetchPlans(deps, now), fetchRecentGreetings(chatId),
  ]);

  return { now, weather, plans, recentGreetings };
}

async function sendGreetingText(
  deps: MorningGreetingDependencies, chatId: number, greeting: GreetingResult, inputs: GreetingInputs,
): Promise<void> {
  if (greeting.kind === "generated") return deps.messenger.sendText(chatId, greeting.reply.text);

  log.info({ reason: greeting.reason }, "canned morning greeting");
  const openingLine = randomGoodMorning[getRandom(randomGoodMorning.length)];
  await deps.messenger.sendHtml(chatId, formatFallbackGreeting(openingLine, clockTimeInTimeZone(inputs.now, GREETING_TIME_ZONE)));
}

/** The random town's weather card; nothing when the weather couldn't be read. */
async function sendWeather(deps: MorningGreetingDependencies, chatId: number, inputs: GreetingInputs): Promise<void> {
  if (!inputs.weather) return;

  await deps.messenger.sendHtml(chatId, formatCityWeather(inputs.weather));
}

/** The coming week's games, with their numbers for `/mukaan`; nothing when none are planned. */
async function sendPlannedGames(deps: MorningGreetingDependencies, chatId: number, inputs: GreetingInputs): Promise<void> {
  if (inputs.plans.length === 0) return;

  await deps.messenger.sendText(chatId, formatGamesPart(inputs.plans, dayInTimeZone(inputs.now, PLAN_TIME_ZONE)));
}

async function sendGif(deps: MorningGreetingDependencies, chatId: number, word: GifSearchWord): Promise<void> {
  const gifUrl = await deps.giphy.searchGif(word);
  if (gifUrl) await deps.messenger.sendAnimation(chatId, gifUrl);
}

/** The model's word, or a random one when the greeting is the canned one. */
function gifWord(greeting: GreetingResult): GifSearchWord {
  if (greeting.kind === "generated") return greeting.reply.gifQuery;

  return giphySearchWords[getRandom(giphySearchWords.length)];
}

function todaysPlans(inputs: GreetingInputs): GamePlan[] {
  const today = dayInTimeZone(inputs.now, PLAN_TIME_ZONE);
  return inputs.plans.filter(plan => plan.day === today);
}

/** A random town's weather; null when it can't be had, and the greeting goes without. */
async function fetchWeather(deps: MorningGreetingDependencies): Promise<CityWeather | null> {
  try {
    const result = await deps.openWeather.getCityWeather(randomTown());
    if (result.kind === "observed") return result.weather;

    log.warn({ reason: result.reason }, "morning greeting weather unavailable");
  } catch (error) {
    log.error({ err: error }, "morning greeting weather failed");
  }
  return null;
}

/** The planning group's games for the coming week; none without a group, or when they can't be read. */
async function fetchPlans(deps: MorningGreetingDependencies, now: Date): Promise<GamePlan[]> {
  if (deps.gamesChatId === undefined) return [];

  try {
    return await listPlansForDays(deps.gamesChatId, GAMES_DAYS, now);
  } catch (error) {
    log.error({ err: error }, "morning greeting games failed");
    return [];
  }
}

/** Sakke's last greetings in the chat; none when they can't be read, and the greeting goes without. */
async function fetchRecentGreetings(chatId: number): Promise<string[]> {
  try {
    return await greetingRepo.findRecentTexts(chatId, RECENT_GREETINGS);
  } catch (error) {
    log.error({ err: error }, "morning greeting history failed");
    return [];
  }
}

/** Saves a sent greeting for the next ones; losing it only costs tomorrow's greeting some variety. */
async function saveGreeting(chatId: number, text: string): Promise<void> {
  try {
    await withWriteRetry("save the morning greeting", () => greetingRepo.save(chatId, text));
  } catch (error) {
    log.error({ err: error }, "morning greeting could not be saved");
  }
}

/** Sends one part of the greeting and says whether it went; a failure is logged and the next part still goes. */
async function sendPart(part: string, send: () => Promise<void>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (error) {
    log.error({ err: error, part }, "morning greeting part failed");
    return false;
  }
}
