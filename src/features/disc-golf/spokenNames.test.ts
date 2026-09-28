import { expect, it } from "vitest";
import { buildSpokenNames } from "./spokenNames";

it("uses capitalized first names when they are unique", () => {
  const names = buildSpokenNames(["Ville Saarinen", "teppo", "tommi Virtanen"]);
  expect(names.get("Ville Saarinen")).toBe("Ville");
  expect(names.get("teppo")).toBe("Teppo");
  expect(names.get("tommi Virtanen")).toBe("Tommi");
});

it("keeps full names for players whose first names collide", () => {
  const names = buildSpokenNames(["Ville Saarinen", "ville Korhonen", "Teppo"]);
  expect(names.get("Ville Saarinen")).toBe("Ville Saarinen");
  expect(names.get("ville Korhonen")).toBe("ville Korhonen");
  expect(names.get("Teppo")).toBe("Teppo");
});

it("treats the same full name listed twice as one player", () => {
  expect(buildSpokenNames(["Ville Saarinen", "Ville Saarinen"]).get("Ville Saarinen")).toBe("Ville");
});
