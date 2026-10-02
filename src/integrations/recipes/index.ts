import { createRecipesClient } from "./client";

/** The bot's recipe client, until commands receive their dependencies from main.ts. */
export const recipes = createRecipesClient();
