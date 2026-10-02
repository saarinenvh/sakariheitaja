import { z } from "zod";
import { getData } from "../../shared/http";

// The S-group recipe API behind yhteishyva.fi, limited to the fields the bot shows.
const RECIPES_URL = "https://api.s-cloud.fi/sok/aws/recipes-delivery/recipes-delivery/v1/recipes?fields=name%2Cdescription%2Cmedia%2Ccategories%2CusageRights%2Cpublisher%2CcookTime%2Cingredients%2Csteps&channel=yhteishyva&client_id=444c050f-ac71-43f9-9f37-c5cbda4c1cbb&environment=master&language=fi&limit=100";

const recipeSchema = z.object({
  name: z.string(),
  cookTime: z.number(),
  description: z.string(),
  ingredients: z.array(z.object({
    ingredientTitle: z.string().optional(),
    name: z.string().optional(),
    ingredients: z.array(z.object({ ingredientTitle: z.string() })).optional(),
  })),
  steps: z.array(z.object({ body: z.string() })),
  // The message sends the first photo, dropping its URL's first two characters; something must be left after them.
  media: z.array(z.object({ file: z.object({ url: z.string() }) })).min(1)
    .refine(media => (media[0]?.file.url ?? "").substring(2) !== "", "empty photo URL"),
});
const recipesResponseSchema = z.object({ results: z.array(z.unknown()) });

/** A recipe with everything the bot's message shows, including at least one photo. */
export type Recipe = z.output<typeof recipeSchema>;

export interface RecipesClient {
  /** Up to 100 recipes, leaving out any the message can't show; null when the request or the reply failed. */
  getRecipes(): Promise<Recipe[] | null>;
}

export function createRecipesClient(): RecipesClient {
  return {
    getRecipes: async () => {
      const response = recipesResponseSchema.safeParse(await getData<unknown>(RECIPES_URL));
      if (!response.success) return null;
      return response.data.results.flatMap(candidate => {
        const recipe = recipeSchema.safeParse(candidate);
        return recipe.success ? [recipe.data] : [];
      });
    },
  };
}
