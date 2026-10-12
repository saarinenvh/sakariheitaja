import { CommandContext, Context } from "grammy";
import { OpenWeatherApi } from "../../../integrations/openweather/api";
import { buildCityWeatherReport, randomTown } from "../../../features/weather-report";
import { HTML_OPTIONS } from "../../sendOptions";
import { weatherMessages as MSG } from "./messages";

type Command = CommandContext<Context>;

export async function showWeather(ctx: Command, openWeather: OpenWeatherApi): Promise<unknown> {
  if (!ctx.match) return ctx.reply(MSG.usage);
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, openWeather, ctx.match.trim());
}

export async function showRandomTownWeather(ctx: Command, openWeather: OpenWeatherApi): Promise<void> {
  await ctx.reply(MSG.intro);
  await replyWithWeather(ctx, openWeather, randomTown());
}

async function replyWithWeather(ctx: Command, openWeather: OpenWeatherApi, city: string): Promise<void> {
  const report = await buildCityWeatherReport(openWeather, city);
  if (report.kind === "found") await ctx.reply(report.html, HTML_OPTIONS);
  else await ctx.reply(report.text);
}
