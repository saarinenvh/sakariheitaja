import { CommandDependencies, CommandGroup } from "../types";
import { forceHeckle, listErroredRounds, sendMorningGreetingNow } from "./dev";

/** Testing aids, registered only when LLM_ENABLED=true and left out of /apua. */
export const devCommands = (deps: CommandDependencies): CommandGroup => ({
  title: "Kehitys:",
  commands: [
    { name: "heckle", handle: ctx => forceHeckle(ctx, deps.ollama) },
    { name: "aamuu", handle: ctx => sendMorningGreetingNow(ctx, deps) },
    { name: "virheet", handle: listErroredRounds },
  ],
});
