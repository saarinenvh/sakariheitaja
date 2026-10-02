import { getData } from "../../shared/http";

// The S-group recipe API behind yhteishyva.fi, limited to the fields the bot shows.
const RECIPES_URL = "https://api.s-cloud.fi/sok/aws/recipes-delivery/recipes-delivery/v1/recipes?fields=name%2Cdescription%2Cmedia%2Ccategories%2CusageRights%2Cpublisher%2CcookTime%2Cingredients%2Csteps&channel=yhteishyva&client_id=444c050f-ac71-43f9-9f37-c5cbda4c1cbb&environment=master&language=fi&limit=100";

export interface RecipeIngredient {
  ingredientTitle?: string;
  name?: string;
  ingredients?: { ingredientTitle: string }[];
}

export interface Recipe {
  name: string;
  cookTime: number;
  description: string;
  ingredients: RecipeIngredient[];
  steps: { body: string }[];
  media: { file: { url: string } }[];
}

export interface RecipesClient {
  /** Up to 100 recipes, or null when the request failed. */
  getRecipes(): Promise<Recipe[] | null>;
}

export function createRecipesClient(): RecipesClient {
  return {
    getRecipes: async () => {
      const response = await getData<{ results: Recipe[] }>(RECIPES_URL);
      return response ? response.results : null;
    },
  };
}
