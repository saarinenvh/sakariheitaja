import { CommandGroup } from "../types";
import { sendGif } from "./gifs";

export const gifCommands: CommandGroup = {
  title: "Gifit:",
  commands: [
    { name: "gifplz", handle: sendGif, help: [{ usage: "/gifplz [hakusana]", description: "Haen hakusanalla gifin." }] },
  ],
};
