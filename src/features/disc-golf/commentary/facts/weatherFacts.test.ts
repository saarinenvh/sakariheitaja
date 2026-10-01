import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentWeather, WeatherObservation } from "../../../../shared/weather";
import { describeWeather, describeWeatherChange } from "./weatherFacts";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../../shared/http", () => ({ getData: mocks.getData }));

function observation(overrides: Partial<WeatherObservation> = {}): WeatherObservation {
  return {
    observedAt: new Date("2026-09-28T10:00:00Z"), temperatureC: 8.2, windSpeedMs: 6, windFromDeg: null,
    description: "pilvistä", precipitationMmPerHour: null, ...overrides,
  };
}

describe("weather description", () => {
  it("states temperature, conditions and wind without precipitation when dry", () => {
    expect(describeWeather(observation())).toBe("Sää: 8 °C, pilvistä, tuulta 6 m/s.");
    expect(describeWeather(observation({ precipitationMmPerHour: 0, windSpeedMs: 3.46 })))
      .toBe("Sää: 8 °C, pilvistä, tuulta 3,5 m/s.");
  });

  it("includes precipitation when it is falling", () => {
    expect(describeWeather(observation({ temperatureC: -0.3, description: "kevyt sade", precipitationMmPerHour: 1.24 })))
      .toBe("Sää: 0 °C, kevyt sade, sademäärä 1,2 mm/h, tuulta 6 m/s.");
  });
});

describe("weather change description", () => {
  it("returns null when nothing meaningful changed, even if the description did", () => {
    expect(describeWeatherChange(observation(), observation({ temperatureC: 10.9, windSpeedMs: 8.9, description: "selkeää" })))
      .toBeNull();
  });

  it("reports temperature and precipitation changes with the new conditions", () => {
    const current = observation({ temperatureC: 4.1, description: "kevyt sade", precipitationMmPerHour: 0.5 });
    expect(describeWeatherChange(observation(), current))
      .toBe("Kierroksen alusta: lämpötila laskenut 4 °C, sade alkanut, sää nyt kevyt sade.");
  });

  it("reports wind changes and stopped precipitation at the thresholds", () => {
    const start = observation({ temperatureC: 5.1, windSpeedMs: 2.1, precipitationMmPerHour: 1 });
    const current = observation({ temperatureC: 8.1, windSpeedMs: 5.1, precipitationMmPerHour: null });
    expect(describeWeatherChange(start, current))
      .toBe("Kierroksen alusta: lämpötila noussut 3 °C, tuuli voimistunut 3 m/s, sade lakannut.");
  });
});

describe("current weather fetch", () => {
  const originalKey = process.env.OPENWEATHERMAP_APIKEY;
  const location = { latitude: 60.19, longitude: 24.9 };

  beforeEach(() => {
    mocks.getData.mockReset();
    process.env.OPENWEATHERMAP_APIKEY = "test-key";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENWEATHERMAP_APIKEY;
    else process.env.OPENWEATHERMAP_APIKEY = originalKey;
  });

  it("maps the observation and sums rain and snow", async () => {
    mocks.getData.mockResolvedValue({
      dt: 1790000000, main: { temp: 7.5 }, wind: { speed: 4.2, deg: 225 }, weather: [{ description: "räntäsade" }],
      rain: { "1h": 0.4 }, snow: { "1h": 0.2 },
    });
    const result = await fetchCurrentWeather(location);
    expect(result).toEqual({ kind: "observed", observation: {
      observedAt: new Date(1790000000 * 1000), temperatureC: 7.5, windSpeedMs: 4.2, windFromDeg: 225,
      description: "räntäsade", precipitationMmPerHour: expect.closeTo(0.6),
    } });
    expect(mocks.getData.mock.calls[0][0]).toContain("lat=60.19&lon=24.9&units=metric&lang=fi&appid=test-key");
  });

  it("reports no precipitation as null", async () => {
    mocks.getData.mockResolvedValue({ dt: 1790000000, main: { temp: 7 }, wind: { speed: 1 }, weather: [{ description: "selkeää" }] });
    const result = await fetchCurrentWeather(location);
    expect(result.kind === "observed" && result.observation.precipitationMmPerHour).toBeNull();
  });

  it("fails without an API key, on request failure and on an invalid body", async () => {
    mocks.getData.mockResolvedValue(undefined);
    await expect(fetchCurrentWeather(location)).resolves.toMatchObject({ kind: "failed" });
    mocks.getData.mockResolvedValue({ cod: 401, message: "Invalid API key" });
    await expect(fetchCurrentWeather(location))
      .resolves.toEqual({ kind: "failed", reason: "Invalid OpenWeatherMap current weather" });
    delete process.env.OPENWEATHERMAP_APIKEY;
    await expect(fetchCurrentWeather(location)).resolves.toEqual({ kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" });
    expect(mocks.getData).toHaveBeenCalledTimes(2);
  });
});
