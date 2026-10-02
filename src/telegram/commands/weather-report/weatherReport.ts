import { CommandContext, Context } from "grammy";
import { openWeather } from "../../../integrations/openweather";
import { buildCityWeatherReport } from "../../../features/weather-report/weatherReport";
import { cities } from "../../../features/weather-report/phrases";
import { getRandom } from "../../../shared/utils";
import { HTML_OPTIONS } from "../../sendOptions";
import { weatherMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

export async function showWeather(ctx: Command): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.usage);
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, ctx.match.trim());
}

export async function showRandomTownWeather(ctx: Command): Promise<void> {
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, cities[getRandom(cities.length)]);
}

async function replyWithWeather(ctx: Command, city: string): Promise<void> {
  const report = await buildCityWeatherReport(openWeather, city);
  if (report.kind === "found") await ctx.reply(report.html, HTML_OPTIONS);
  else await ctx.reply(report.text);
}
