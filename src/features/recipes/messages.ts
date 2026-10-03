import { Recipe } from "../../integrations/recipes/client";

/** `/mitatanaansyotaisiin`: a recipe as text (name, time, description, ingredients, steps) and its photo. */
export interface RecipeMessage {
  text: string;
  photoUrl: string;
}

export function formatRecipe(dish: Recipe): RecipeMessage {
  let message = `${dish.name} ${dish.cookTime}min\n\n${dish.description}\n\n`;
  dish.ingredients.forEach(n => {
    if (n.ingredientTitle) {
      message += n.ingredientTitle + "\n";
    } else {
      message += (n.name ?? "") + "\n";
      n.ingredients?.forEach(i => (message += i.ingredientTitle + "\n"));
    }
  });
  message += "\n";
  dish.steps.forEach((n, i) => (message += `${i + 1}. ${n.body} \n`));
  return { text: message, photoUrl: dish.media[0].file.url.substring(2) };
}
