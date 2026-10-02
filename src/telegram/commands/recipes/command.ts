import { CommandGroup } from "../types";
import { suggestRecipe } from "./recipes";

export const recipeCommands: CommandGroup = {
  title: "Ruoka:",
  commands: [
    { name: "mitatanaansyotaisiin", handle: suggestRecipe,
      help: [{ usage: "/mitatanaansyotaisiin", description: "Ehdotan reseptin, jos ei muuten keksi mitä syödä." }] },
  ],
};
