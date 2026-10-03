import { getData } from "../../shared/http";
import { Recipe, recipeSchema, recipesSchema } from "./schema";

export type { Recipe } from "./schema";

// The S-group recipe API behind yhteishyva.fi, limited to the fields the bot shows.
const RECIPES_URL = "https://api.s-cloud.fi/sok/aws/recipes-delivery/recipes-delivery/v1/recipes?fields=name%2Cdescription%2Cmedia%2Ccategories%2CusageRights%2Cpublisher%2CcookTime%2Cingredients%2Csteps&channel=yhteishyva&client_id=444c050f-ac71-43f9-9f37-c5cbda4c1cbb&environment=master&language=fi&limit=100";

export interface RecipesClient {
  /** Up to 100 recipes, leaving out any the message can't show; null when the request or the reply failed. */
  getRecipes(): Promise<Recipe[] | null>;
}

export function createRecipesClient(): RecipesClient {
  return {
    getRecipes: async () => {
      const response = recipesSchema.safeParse(await getData(RECIPES_URL));
      if (!response.success) return null;
      return response.data.results.flatMap(candidate => {
        const recipe = recipeSchema.safeParse(candidate);
        return recipe.success ? [recipe.data] : [];
      });
    },
  };
}
