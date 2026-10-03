import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../shared/validation";
import { recipeExample, recipeSchema, recipesExample, recipesSchema } from "../schema";

describe("recipe API schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(recipesSchema, recipesExample, "recipes example")).not.toThrow();
    expect(() => parseOrThrow(recipeSchema, recipeExample, "recipe example")).not.toThrow();
  });
});
