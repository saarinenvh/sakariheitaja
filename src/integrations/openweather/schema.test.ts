import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../shared/validation";
import { cityWeatherExample, cityWeatherSchema, currentWeatherExample, currentWeatherSchema } from "./schema";

describe("OpenWeatherMap schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(currentWeatherSchema, currentWeatherExample, "OpenWeatherMap current weather example")).not.toThrow();
    expect(() => parseOrThrow(cityWeatherSchema, cityWeatherExample, "OpenWeatherMap city weather example")).not.toThrow();
  });
});
