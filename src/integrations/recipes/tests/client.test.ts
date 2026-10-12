import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));

import { createRecipesClient } from "../client";

const soup = {
  name: "Keitto", cookTime: 30, description: "Hyvää.", ingredients: [{ ingredientTitle: "Vesi" }],
  steps: [{ body: "Keitä." }], media: [{ damAsset: { url: "https://cdn.example/keitto.webp" } }],
};

beforeEach(() => mocks.getData.mockReset());

describe("recipes client", () => {
  const client = createRecipesClient();

  it("returns the recipes, leaving out ones the message can't show", async () => {
    mocks.getData.mockResolvedValue({ results: [
      soup, { ...soup, name: "Kuvaton", media: [] }, { ...soup, name: "Tyhjä kuva", media: [{ damAsset: { url: "" } }] },
      { ...soup, name: "Puolikas osoite", media: [{ damAsset: { url: "//cdn.example/keitto.webp" } }] },
      { ...soup, name: "FTP-kuva", media: [{ damAsset: { url: "ftp://cdn.example/keitto.webp" } }] }, { name: "Rikki" },
    ] });
    expect(await client.getRecipes()).toEqual([soup]);
  });

  it("leaves out a recipe whose photo is in the API's old `file` shape", async () => {
    mocks.getData.mockResolvedValue({ results: [soup, { ...soup, name: "Vanha", media: [{ file: { url: "//kuva.jpg" } }] }] });
    expect(await client.getRecipes()).toEqual([soup]);
  });

  it("checks only the first photo, the one the message sends", async () => {
    const gallery = { ...soup, media: [{ damAsset: { url: "https://cdn.example/keitto.webp" } }, { damAsset: { url: "" } }] };
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
