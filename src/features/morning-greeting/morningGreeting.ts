import { ChatMessenger } from "../chatMessenger";
import { CityWeather, OpenWeatherApi } from "../../integrations/openweather/api";
import { GiphyClient } from "../../integrations/giphy/client";
import { OllamaClient } from "../../integrations/ollama/client";
import { formatCityWeather, randomTown } from "../weather-report";
import { GifSearchWord, giphySearchWords, randomGoodMorning } from "./phrases";
import { formatFallbackGreeting } from "./messages";
import { formatClockTime, getRandom } from "../../shared/utils";
import { moduleLogger } from "../../shared/logger";
import { dayInTimeZone } from "../../shared/time";
import { GamePlan, listPlansForDays, PLAN_TIME_ZONE } from "../games";
import { formatGamesPart } from "./gamesPart";
import { msUntilNextGreeting } from "./policy";
import { buildGreetingFacts } from "./facts";
import { GreetingResult, writeGreeting } from "./greetingWriter";

const log = moduleLogger("morning-greeter");

/** How many days of planned games the greeting lists, today included. */
const GAMES_DAYS = 7;

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
  mood: string;
  weather: CityWeather | null;
  /** The planning group's games for the coming week. */
  plans: GamePlan[];
}

/**
 * Sakke's greeting, written by the model from the day's facts (or the canned greeting with the
 * weather card when it can't be), then the coming week's games and a gif; each part is sent even if
 * another fails.
 */
export async function sendMorningGreeting(deps: MorningGreetingDependencies, chatId: number): Promise<void> {
  const inputs = await gatherInputs(deps);

  const greeting = await writeGreeting(deps.ollama, buildGreetingFacts({ ...inputs, todaysPlans: todaysPlans(inputs) }), deps.llmEnabled);

  await sendPart("text", () => sendGreetingText(deps, chatId, greeting, inputs));
  await sendPart("games", () => sendPlannedGames(deps, chatId, inputs));
  await sendPart("gif", () => sendGif(deps, chatId, gifWord(greeting)));
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
    await sendMorningGreeting(deps, chatId);
    startMorningGreeter(deps, chatId);
  }, delayMs);
}

async function gatherInputs(deps: MorningGreetingDependencies): Promise<GreetingInputs> {
  const now = new Date();
  const mood = randomGoodMorning[getRandom(randomGoodMorning.length)];

  const [weather, plans] = await Promise.all([fetchWeather(deps), fetchPlans(deps, now)]);

  return { now, mood, weather, plans };
}

async function sendGreetingText(
  deps: MorningGreetingDependencies, chatId: number, greeting: GreetingResult, inputs: GreetingInputs,
): Promise<void> {
  if (greeting.kind === "generated") return deps.messenger.sendText(chatId, greeting.reply.text);

  log.info({ reason: greeting.reason }, "canned morning greeting");
  await deps.messenger.sendHtml(chatId, formatFallbackGreeting(inputs.mood, formatClockTime(inputs.now)));
  if (inputs.weather) await deps.messenger.sendHtml(chatId, formatCityWeather(inputs.weather));
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
  const result = await deps.openWeather.getCityWeather(randomTown());
  if (result.kind === "observed") return result.weather;

  log.warn({ reason: result.reason }, "morning greeting weather unavailable");
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

/** Sends one part of the greeting; a failure is logged and the next part still goes. */
async function sendPart(part: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    log.error({ err: error, part }, "morning greeting part failed");
  }
}
