import { describe, expect, it } from "vitest";
import { formatRecipe } from "../messages";
import { recipeExample, recipeSchema } from "../../../integrations/recipes/schema";

describe("formatRecipe", () => {
  it("writes the name, time, description, ingredients and numbered steps, and sends the first photo's URL whole", () => {
    const secondPhoto = { damAsset: { url: "https://cdn.s-cloud.fi/v1/assets/dam-id/toinen.webp" } };
    const recipe = recipeSchema.parse({ ...recipeExample, media: [...recipeExample.media, secondPhoto] });

    expect(formatRecipe(recipe)).toEqual({
      text: "Esimerkkikakku 60min\n\nHelppo kakku, joka valmistuu sekoittamalla taikinan ainekset.\n\n"
        + "2 dl vehnäjauhoja\nKuorrute\n1 dl sokeria\n\n1. Kuumenna uuni 175 asteeseen.\n \n",
      photoUrl: "https://cdn.s-cloud.fi/v1/assets/dam-id/esimerkkikakku.webp?clientId=6548",
    });
  });
});
