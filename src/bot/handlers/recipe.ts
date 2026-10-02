import { Composer } from "grammy";
import { recipes } from "../../integrations/recipes";
import { formatRecipe } from "../../features/recipes/recipes";
import { getRandom } from "../../shared/utils";
import { recipe as MSG } from "../../config/messages";

export const recipe = new Composer();

// /mitatanaansyotaisiin
// Fetches a random Finnish recipe from the S-cloud recipe API and sends the
// name, cook time, description, ingredient list, step-by-step instructions,
// and a photo of the dish.
recipe.command("mitatanaansyotaisiin", async ctx => {
  const results = await recipes.getRecipes();
  if (!results) return ctx.reply(MSG.notFound);
  const { text, photoUrl } = formatRecipe(results[getRandom(results.length)]);

  await ctx.reply(text);
  await ctx.replyWithPhoto(photoUrl);
});
