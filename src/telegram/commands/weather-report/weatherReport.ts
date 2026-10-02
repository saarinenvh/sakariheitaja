import { Composer, Context } from "grammy";
import { openWeather } from "../../../integrations/openweather";
import { buildCityWeatherReport } from "../../../features/weather-report/weatherReport";
import { HTML_OPTIONS } from "../../sendOptions";
import { citys } from "../../../config/phrases";
import { getRandom } from "../../../shared/utils";
import { weather as MSG } from "../../messages";

export const weather = new Composer();

// /saa <city>
// Fetches current weather for the given city from OpenWeatherMap and sends
// a formatted message with temperature, conditions, wind speed, and sunrise/sunset times.
weather.command("saa", async ctx => {
  if (!ctx.match) return ctx.reply(MSG.usage);
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, ctx.match.trim());
});

// /randomsaa
// Same as /saa but picks a random city from the predefined city list in phrases config.
weather.command("randomsaa", async ctx => {
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, citys[getRandom(citys.length)]);
});

async function replyWithWeather(ctx: Context, city: string): Promise<void> {
  const report = await buildCityWeatherReport(openWeather, city);
  if (report.kind === "found") await ctx.reply(report.html, HTML_OPTIONS);
  else await ctx.reply(report.text);
}
