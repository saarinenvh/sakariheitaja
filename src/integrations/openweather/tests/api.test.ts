import { describe, expect, it, vi } from "vitest";
import { createOpenWeatherApi } from "../api";
import { OpenWeatherClient, OpenWeatherResponse } from "../client";

function clientReturning(response: OpenWeatherResponse) {
  return { get: vi.fn<OpenWeatherClient["get"]>().mockResolvedValue(response) } satisfies OpenWeatherClient;
}

describe("current weather", () => {
  const location = { latitude: 60.19, longitude: 24.9 };

  it("asks by coordinates, maps the observation and sums rain and snow", async () => {
    const client = clientReturning({ kind: "ok", body: {
      dt: 1790000000, main: { temp: 7.5 }, wind: { speed: 4.2, deg: 225 }, weather: [{ description: "räntäsade" }],
      rain: { "1h": 0.4 }, snow: { "1h": 0.2 },
    } });

    const result = await createOpenWeatherApi(client).getCurrentWeather(location);

    expect(client.get).toHaveBeenCalledWith("/weather", { lat: "60.19", lon: "24.9" });
    expect(result).toEqual({ kind: "observed", observation: {
      observedAt: new Date(1790000000 * 1000), temperatureC: 7.5, windSpeedMs: 4.2, windFromDeg: 225,
      description: "räntäsade", precipitationMmPerHour: expect.closeTo(0.6),
    } });
  });

  it("reports no precipitation as null", async () => {
    const client = clientReturning({ kind: "ok", body: { dt: 1790000000, main: { temp: 7 }, wind: { speed: 1 }, weather: [{ description: "selkeää" }] } });

    const result = await createOpenWeatherApi(client).getCurrentWeather(location);

    expect(result.kind === "observed" && result.observation.precipitationMmPerHour).toBeNull();
  });

  it("fails on the client's failure and on a body that isn't a weather report", async () => {
    await expect(createOpenWeatherApi(clientReturning({ kind: "failed", reason: "OpenWeatherMap request failed" })).getCurrentWeather(location))
      .resolves.toEqual({ kind: "failed", reason: "OpenWeatherMap request failed" });
    await expect(createOpenWeatherApi(clientReturning({ kind: "ok", body: { cod: 401, message: "Invalid API key" } })).getCurrentWeather(location))
      .resolves.toEqual({ kind: "failed", reason: "Invalid OpenWeatherMap current weather" });
  });
});

describe("city weather", () => {
  it("asks by name and returns the city's conditions, normalized", async () => {
    const client = clientReturning({ kind: "ok", body: {
      name: "Helsinki", main: { temp: 7 }, weather: [{ main: "Rain", description: "sade" }], wind: { speed: 3 },
      sys: { sunrise: 1790000000, sunset: 1790036000 },
    } });

    const result = await createOpenWeatherApi(client).getCityWeather("Helsinki");

    expect(client.get).toHaveBeenCalledWith("/weather", { q: "Helsinki" });
    expect(result).toEqual({ kind: "observed", weather: {
      city: "Helsinki", temperatureC: 7, windSpeedMs: 3, description: "sade", condition: "Rain",
      sunrise: new Date(1790000000 * 1000), sunset: new Date(1790036000 * 1000),
    } });
  });

  it("fails for a city OpenWeatherMap doesn't know, a reply missing what /saa shows, and on the client's failure", async () => {
    await expect(createOpenWeatherApi(clientReturning({ kind: "ok", body: { cod: "404", message: "city not found" } })).getCityWeather("Atlantis"))
      .resolves.toEqual({ kind: "failed", reason: "Invalid OpenWeatherMap city weather" });
    await expect(createOpenWeatherApi(clientReturning({ kind: "ok", body: { name: "Helsinki", weather: [{ main: "Rain", description: "sade" }] } })).getCityWeather("Helsinki"))
      .resolves.toMatchObject({ kind: "failed" });
    await expect(createOpenWeatherApi(clientReturning({ kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" })).getCityWeather("Helsinki"))
      .resolves.toEqual({ kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" });
  });
});
