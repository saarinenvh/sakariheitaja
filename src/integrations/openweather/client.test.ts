import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../shared/http", () => ({ getData: mocks.getData }));

import { createOpenWeatherClient } from "./client";

describe("current weather fetch", () => {
  const location = { latitude: 60.19, longitude: 24.9 };
  const client = createOpenWeatherClient({ apiKey: "test-key" });

  beforeEach(() => mocks.getData.mockReset());

  it("maps the observation and sums rain and snow", async () => {
    mocks.getData.mockResolvedValue({
      dt: 1790000000, main: { temp: 7.5 }, wind: { speed: 4.2, deg: 225 }, weather: [{ description: "räntäsade" }],
      rain: { "1h": 0.4 }, snow: { "1h": 0.2 },
    });
    const result = await client.getCurrentWeather(location);
    expect(result).toEqual({ kind: "observed", observation: {
      observedAt: new Date(1790000000 * 1000), temperatureC: 7.5, windSpeedMs: 4.2, windFromDeg: 225,
      description: "räntäsade", precipitationMmPerHour: expect.closeTo(0.6),
    } });
    expect(mocks.getData.mock.calls[0][0]).toContain("lat=60.19&lon=24.9&units=metric&lang=fi&appid=test-key");
  });

  it("reports no precipitation as null", async () => {
    mocks.getData.mockResolvedValue({ dt: 1790000000, main: { temp: 7 }, wind: { speed: 1 }, weather: [{ description: "selkeää" }] });
    const result = await client.getCurrentWeather(location);
    expect(result.kind === "observed" && result.observation.precipitationMmPerHour).toBeNull();
  });

  it("fails without an API key, on request failure and on an invalid body", async () => {
    mocks.getData.mockResolvedValue(undefined);
    await expect(client.getCurrentWeather(location)).resolves.toMatchObject({ kind: "failed" });
    mocks.getData.mockResolvedValue({ cod: 401, message: "Invalid API key" });
    await expect(client.getCurrentWeather(location))
      .resolves.toEqual({ kind: "failed", reason: "Invalid OpenWeatherMap current weather" });
    await expect(createOpenWeatherClient({ apiKey: undefined }).getCurrentWeather(location))
      .resolves.toEqual({ kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" });
    expect(mocks.getData).toHaveBeenCalledTimes(2);
  });
});

describe("city weather", () => {
  it("returns the city's conditions, or null for a city OpenWeatherMap doesn't know", async () => {
    const client = createOpenWeatherClient({ apiKey: "test-key" });
    const helsinki = { name: "Helsinki", main: { temp: 7 }, weather: [{ main: "Rain", description: "sade" }], wind: { speed: 3 }, sys: { sunrise: 1, sunset: 2 } };
    mocks.getData.mockResolvedValueOnce(helsinki);
    expect(await client.getCityWeather("Helsinki")).toBe(helsinki);
    expect(mocks.getData.mock.calls.at(-1)?.[0]).toBe("https://api.openweathermap.org/data/2.5/weather?q=Helsinki&units=metric&lang=fi&appid=test-key");
    mocks.getData.mockResolvedValueOnce({ cod: "404", message: "city not found" });
    expect(await client.getCityWeather("Atlantis")).toBeNull();
  });
});
