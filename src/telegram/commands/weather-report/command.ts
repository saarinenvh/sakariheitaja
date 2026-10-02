import { CommandDependencies, CommandGroup } from "../types";
import { showRandomTownWeather, showWeather } from "./weatherReport";

export const weatherCommands = ({ openWeather }: CommandDependencies): CommandGroup => ({
  title: "Sää:",
  commands: [
    { name: "saa", handle: ctx => showWeather(ctx, openWeather),
      help: [{ usage: "/saa [kaupunki]", description: "Kerron kaupungin sään, auringonnousun ja -laskun." }] },
    { name: "randomsaa", handle: ctx => showRandomTownWeather(ctx, openWeather),
      help: [{ usage: "/randomsaa", description: "Kerron jonkun suomalaisen kaupungin sään." }] },
  ],
});
