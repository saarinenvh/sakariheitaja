import { CommandDependencies, CommandGroup } from "../types";
import { sendGif } from "./gifs";

export const gifCommands = ({ giphy }: CommandDependencies): CommandGroup => ({
  title: "Gifit:",
  commands: [
    { name: "gifplz", handle: ctx => sendGif(ctx, giphy), help: [{ usage: "/gifplz [hakusana]", description: "Haen hakusanalla gifin." }] },
  ],
});
