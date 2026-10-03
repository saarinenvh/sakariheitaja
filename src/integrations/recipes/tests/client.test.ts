import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));

import { createRecipesClient } from "../client";

const soup = {
  name: "Keitto", cookTime: 30, description: "Hyvää.", ingredients: [{ ingredientTitle: "Vesi" }],
  steps: [{ body: "Keitä." }], media: [{ file: { url: "//kuva.jpg" } }],
};

beforeEach(() => mocks.getData.mockReset());

describe("recipes client", () => {
  const client = createRecipesClient();

  it("returns the recipes, leaving out ones the message can't show", async () => {
    mocks.getData.mockResolvedValue({ results: [
      soup, { ...soup, name: "Kuvaton", media: [] }, { ...soup, name: "Tyhjä kuva", media: [{ file: { url: "" } }] }, { name: "Rikki" },
    ] });
    expect(await client.getRecipes()).toEqual([soup]);
  });

  it("checks only the first photo, the one the message sends", async () => {
    const gallery = { ...soup, media: [{ file: { url: "//kuva.jpg" } }, { file: { url: "" } }] };
    mocks.getData.mockResolvedValue({ results: [gallery] });
    expect(await client.getRecipes()).toEqual([gallery]);
  });

  it("returns null when the request fails or the reply has no recipe list", async () => {
    mocks.getData.mockResolvedValue(undefined);
    expect(await client.getRecipes()).toBeNull();
    mocks.getData.mockResolvedValue({ results: "none" });
    expect(await client.getRecipes()).toBeNull();
    mocks.getData.mockResolvedValue({});
    expect(await client.getRecipes()).toBeNull();
  });
});
