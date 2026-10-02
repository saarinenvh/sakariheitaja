import { CommandGroup } from "../types";
import { forceHeckle, sendMorningGreetingNow } from "./dev";

/** Testing aids, registered only when LLM_ENABLED=true and left out of /apua. */
export const devCommands: CommandGroup = {
  title: "Kehitys:",
  commands: [
    { name: "heckle", handle: forceHeckle },
    { name: "aamuu", handle: sendMorningGreetingNow },
  ],
};
