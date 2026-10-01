import { Bot } from "grammy";
import { sendWeatherMessage } from "../shared/weather";
import { searchGiphy } from "../shared/giphy";
import { getRandom, formatDate } from "../shared/utils";
import { randomGoodMorning, giphySearchWords, citys } from "../config/phrases";
import Logger from "js-logger";
import { HTML_OPTIONS } from "../config/bot";
import { readConfig } from "../config";

export async function sendMorningGreeting(api: Bot["api"], chatId: number): Promise<void> {
  const greeting = randomGoodMorning[getRandom(randomGoodMorning.length)];
  const message = `${greeting}Kello on <b>${formatDate(new Date())}</b> & tämmöstä keliä ois sit tänää taas luvassa.`;

  try { await api.sendMessage(chatId, message, HTML_OPTIONS); } catch (e: any) { Logger.error(`Morning greeter text: ${e.message}`); }
  try { await sendWeatherMessage(citys[getRandom(citys.length)], chatId, api); } catch (e: any) { Logger.error(`Morning greeter weather: ${e.message}`); }
  try { await api.sendMessage(chatId, "Ja tästä päivä käyntiin!"); } catch (e: any) { Logger.error(`Morning greeter cta: ${e.message}`); }
  try {
    const gifUrl = await searchGiphy(giphySearchWords[getRandom(giphySearchWords.length)]);
    if (gifUrl) await api.sendVideo(chatId, gifUrl);
  } catch (e: any) { Logger.error(`Morning greeter gif: ${e.message}`); }
}

export function startMorningGreeter(bot: Bot): void {
  const chatId = readConfig().telegram.morningChatId;
  if (chatId === undefined) {
    Logger.info("MORNING_CHAT_ID not set, skipping morning greeting");
    return;
  }

  const now = new Date();
  let millisTill09 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0).getTime() - now.getTime();
  if (millisTill09 < 0) millisTill09 += 86400000;

  Logger.info(`MS to next morning ${millisTill09}`);

  setTimeout(async () => {
    await sendMorningGreeting(bot.api, chatId);
    startMorningGreeter(bot);
  }, millisTill09);
}
