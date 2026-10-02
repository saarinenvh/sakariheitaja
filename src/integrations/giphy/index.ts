import { readConfig } from "../../config";
import { createGiphyClient } from "./client";

/** The bot's Giphy client, until commands receive their dependencies from main.ts. */
export const giphy = createGiphyClient({ apiKey: readConfig().giphyApiKey });
