import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenWeatherClient, WeatherObservation } from "../../../integrations/openweather/client";

import { RoundCourseData } from "../courseData";
import { MetrixClient } from "../../../integrations/metrix/client";
import { CourseDetails } from "../../../integrations/metrix/course/courseDetails";
import { MetrixRound } from "../../../integrations/metrix/round/types";

const getCurrentWeather = vi.fn<OpenWeatherClient["getCurrentWeather"]>();

const observation: WeatherObservation = {
  observedAt: new Date(0), temperatureC: 12, windSpeedMs: 3, windFromDeg: 180, description: "pilvistä", precipitationMmPerHour: null,
};
const round: MetrixRound = {
  id: "123", name: "Viikkokisa", day: "2026-10-02", startsAt: null, courseName: "Veikkola &rarr; Main", courseId: "456",
  layoutKey: "layout", holeLabels: [], players: [],
};
const details: CourseDetails = { courseId: "456", location: { latitude: 60.2, longitude: 24.5 }, rating: null, holes: [] };

const openWeather: OpenWeatherClient = { getCurrentWeather, getCityWeather: vi.fn() };

function metrix(overrides: Partial<MetrixClient> = {}): MetrixClient {
  return {
    getRound: vi.fn(),
    getCourseDetails: vi.fn().mockResolvedValue({ kind: "unconfigured" }),
    getCourseStatistics: vi.fn().mockResolvedValue({ kind: "not-found" }),
    findCourseLocation: vi.fn().mockResolvedValue({ kind: "found", location: { latitude: 61, longitude: 25, city: "Veikkola" } }),
    ...overrides,
  };
}

beforeEach(() => getCurrentWeather.mockReset().mockResolvedValue({ kind: "observed", observation }));

describe("round course data", () => {
  it("fetches the course once per round", async () => {
    const client = metrix({ getCourseDetails: vi.fn().mockResolvedValue({ kind: "found", details }) });
    const course = new RoundCourseData(client, openWeather, "123", () => round);
    expect(await course.info()).toEqual({ details, statistics: null });
    await course.info();
    expect(client.getCourseDetails).toHaveBeenCalledTimes(1);
  });

  it("takes the weather at the layout's own coordinates when it has them", async () => {
    const client = metrix({ getCourseDetails: vi.fn().mockResolvedValue({ kind: "found", details }) });
    expect(await new RoundCourseData(client, openWeather, "123", () => round).weather()).toBe(observation);
    expect(getCurrentWeather).toHaveBeenCalledWith({ latitude: 60.2, longitude: 24.5, city: null });
    expect(client.findCourseLocation).not.toHaveBeenCalled();
  });

  it("falls back to the course list and remembers the location it found", async () => {
    const client = metrix();
    const course = new RoundCourseData(client, openWeather, "123", () => round);
    await course.weather();
    await course.weather();
    expect(client.findCourseLocation).toHaveBeenCalledTimes(1);
    expect(getCurrentWeather).toHaveBeenLastCalledWith({ latitude: 61, longitude: 25, city: "Veikkola" });
  });

  it("gives no weather or course data when the round has no course id", async () => {
    const client = metrix();
    const course = new RoundCourseData(client, openWeather, "123", () => ({ ...round, courseId: null }));
    expect(await course.weather()).toBeNull();
    expect(await course.info()).toEqual({ details: null, statistics: null });
    expect(client.getCourseDetails).not.toHaveBeenCalled();
  });
});
