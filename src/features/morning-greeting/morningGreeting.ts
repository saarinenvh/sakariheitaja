import { Bot } from "grammy";
import { sendWeatherMessage } from "../../integrations/openweather/client";
import { searchGiphy } from "../../integrations/giphy/client";
import { getRandom, formatDate } from "../../shared/utils";
import { randomGoodMorning, giphySearchWords, citys } from "../../config/phrases";
import { moduleLogger } from "../../shared/logger";
import { HTML_OPTIONS } from "../../config/bot";
import { readConfig } from "../../config";

const log = moduleLogger("morning-greeter");

export async function sendMorningGreeting(api: Bot["api"], chatId: number): Promise<void> {
  const greeting = randomGoodMorning[getRandom(randomGoodMorning.length)];
  const message = `${greeting}Kello on <b>${formatDate(new Date())}</b> & tämmöstä keliä ois sit tänää taas luvassa.`;

  try { await api.sendMessage(chatId, message, HTML_OPTIONS); } catch (e: any) { log.error({ err: e }, "morning greeting text failed"); }
  try { await sendWeatherMessage(citys[getRandom(citys.length)], chatId, api); } catch (e: any) { log.error({ err: e }, "morning greeting weather failed"); }
  try { await api.sendMessage(chatId, "Ja tästä päivä käyntiin!"); } catch (e: any) { log.error({ err: e }, "morning greeting call to action failed"); }
  try {
    const gifUrl = await searchGiphy(giphySearchWords[getRandom(giphySearchWords.length)]);
    if (gifUrl) await api.sendVideo(chatId, gifUrl);
  } catch (e: any) { log.error({ err: e }, "morning greeting gif failed"); }
}

export function startMorningGreeter(bot: Bot): void {
  const chatId = readConfig().telegram.morningChatId;
  if (chatId === undefined) {
    log.info("MORNING_CHAT_ID not set, skipping morning greeting");
    return;
  }

  const now = new Date();
  let millisTill09 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0).getTime() - now.getTime();
  if (millisTill09 < 0) millisTill09 += 86400000;

  log.info({ delayMs: millisTill09 }, "next morning greeting scheduled");

  setTimeout(async () => {
    await sendMorningGreeting(bot.api, chatId);
    startMorningGreeter(bot);
  }, millisTill09);
}
