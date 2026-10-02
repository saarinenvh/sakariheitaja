import { Composer } from "grammy";
import { sendWeatherMessage } from "../../integrations/openweather/client";
import { citys } from "../../config/phrases";
import { getRandom } from "../../shared/utils";
import { weather as MSG } from "../../config/messages";

export const weather = new Composer();

// /saa <city>
// Fetches current weather for the given city from OpenWeatherMap and sends
// a formatted message with temperature, conditions, wind speed, and sunrise/sunset times.
weather.command("saa", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.usage);
  await ctx.reply(MSG.intro);
  await sendWeatherMessage(ctx.match.trim(), ctx.chat.id, ctx.api);
});

// /randomsaa
// Same as /saa but picks a random city from the predefined city list in phrases config.
weather.command("randomsaa", async ctx => {
  await ctx.reply(MSG.intro);
  await sendWeatherMessage(citys[getRandom(citys.length)], ctx.chat.id, ctx.api);
});
