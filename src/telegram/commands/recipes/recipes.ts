import { CommandContext, Context } from "grammy";
import { RecipesClient } from "../../../integrations/recipes/client";
import { formatRecipe } from "../../../features/recipes/recipes";
import { getRandom } from "../../../shared/utils";
import { recipeMessages as MSG } from "./messages";

/** A random recipe: the text, then its photo. */
export async function suggestRecipe(ctx: CommandContext<Context>, recipes: RecipesClient): Promise<unknown> {
  const results = await recipes.getRecipes();
  if (!results?.length) return ctx.reply(MSG.notFound);
  const { text, photoUrl } = formatRecipe(results[getRandom(results.length)]);

  await ctx.reply(text);
  await ctx.replyWithPhoto(photoUrl);
}
