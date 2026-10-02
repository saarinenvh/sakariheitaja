import { readConfig } from "../../config";
import { createChallongeClient } from "./client";

/** The bot's Challonge client, until commands receive their dependencies from main.ts. */
export const challonge = createChallongeClient(readConfig().challonge);
