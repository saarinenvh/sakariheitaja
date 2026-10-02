import { describe, expect, it } from "vitest";
import { WeatherObservation } from "../../../integrations/openweather/client";
import { describeWeather, describeWeatherChange } from "./weatherFacts";

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
