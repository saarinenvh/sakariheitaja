import { CommandGroup } from "../types";
import { showRandomTownWeather, showWeather } from "./weatherReport";

export const weatherCommands: CommandGroup = {
  title: "Sää:",
  commands: [
    { name: "saa", handle: showWeather,
      help: [{ usage: "/saa [kaupunki]", description: "Kerron kaupungin sään, auringonnousun ja -laskun." }] },
    { name: "randomsaa", handle: showRandomTownWeather,
      help: [{ usage: "/randomsaa", description: "Kerron jonkun suomalaisen kaupungin sään." }] },
  ],
};
