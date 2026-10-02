import { readConfig } from "../../config";
import { createOllamaClient } from "./client";

/** The bot's Ollama client, until commands receive their dependencies from main.ts. */
export const ollama = createOllamaClient(readConfig().ollama);
