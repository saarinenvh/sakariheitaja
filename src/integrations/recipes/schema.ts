import { z } from "zod";

// S-group recipe API (behind yhteishyva.fi) → bot, GET api.s-cloud.fi/…/v1/recipes (JSON).

const ingredientExample = {
  minAmount: 2, // ignored
  amountType: "dl", // ignored
  name: "vehnäjauhoja", // ignored: ingredientTitle is shown instead
  ingredientTitle: "2 dl vehnäjauhoja",
  ingredientOptions: [], // ignored
  _id: "ingredient-1", // ignored
  _type: "recipeIngredient", // ignored
};

export const recipeExample = {
  _id: "recipe-1", // ignored
  _type: "recipe", // ignored
  _createdAt: "2026-10-01T02:40:09.454Z", // ignored
  _updatedAt: "2026-10-01T02:40:09.454Z", // ignored
  name: "Esimerkkikakku",
  description: "Helppo kakku, joka valmistuu sekoittamalla taikinan ainekset.",
  // The live API now sends `damAsset: { url, … }` in place of `file`, which this schema rejects.
  media: [{ file: { url: "//images.example.com/esimerkkikakku.jpg" } }],
  categories: { foodType: ["Kakut"], preparation: ["Leivonta"] }, // ignored
  publisher: { id: "yhteishyva", _id: "publisher-1", _type: "publisher" }, // ignored
  cookTime: 60,
  ingredients: [
    ingredientExample,
    {
      name: "Kuorrute",
      ingredients: [{ ...ingredientExample, ingredientTitle: "1 dl sokeria" }],
      _id: "group-1", // ignored
      _type: "ingredientGroup", // ignored
    },
  ],
  steps: [
    {
      body: "Kuumenna uuni 175 asteeseen.\n",
      ingredients: [ingredientExample], // ignored
      _id: "step-1", // ignored
      _type: "recipeInstruction", // ignored
    },
  ],
};

export const recipesExample = {
  limit: 100, // ignored
  cursor: 100, // ignored
  results: [recipeExample],
};

export const recipeSchema = z.object({
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

/** Each recipe is parsed on its own with `recipeSchema`, so one the message can't show is left out. */
export const recipesSchema = z.object({ results: z.array(z.unknown()) });

/** A recipe with everything the bot's message shows, including at least one photo. */
export type Recipe = z.output<typeof recipeSchema>;
