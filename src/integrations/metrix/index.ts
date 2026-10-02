import { readConfig } from "../../config";
import { createMetrixClient } from "./client";

/** The bot's Metrix client, until commands receive their dependencies from main.ts. */
export const metrixClient = createMetrixClient(readConfig().metrix);
