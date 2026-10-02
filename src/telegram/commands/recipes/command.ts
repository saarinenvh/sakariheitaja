import { CommandDependencies, CommandGroup } from "../types";
import { suggestRecipe } from "./recipes";

export const recipeCommands = ({ recipes }: CommandDependencies): CommandGroup => ({
  title: "Ruoka:",
  commands: [
    { name: "mitatanaansyotaisiin", handle: ctx => suggestRecipe(ctx, recipes),
      help: [{ usage: "/mitatanaansyotaisiin", description: "Ehdotan reseptin, jos ei muuten keksi mitä syödä." }] },
  ],
});
