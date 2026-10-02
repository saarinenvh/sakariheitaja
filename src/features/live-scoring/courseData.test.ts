import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherObservation } from "../../integrations/openweather/client";

const mocks = vi.hoisted(() => ({ fetchCurrentWeather: vi.fn() }));
vi.mock("../../integrations/openweather/client", () => ({ fetchCurrentWeather: mocks.fetchCurrentWeather }));

import { RoundCourseData } from "./courseData";
import { MetrixClient } from "../../integrations/metrix/client";
import { CourseDetails } from "../../integrations/metrix/course/courseDetails";
import { MetrixRound } from "../../integrations/metrix/round/types";

const observation: WeatherObservation = {
  observedAt: new Date(0), temperatureC: 12, windSpeedMs: 3, windFromDeg: 180, description: "pilvistä", precipitationMmPerHour: null,
};
const round: MetrixRound = {
  id: "123", name: "Viikkokisa", date: "2026-10-02", courseName: "Veikkola &rarr; Main", courseId: "456",
  layoutKey: "layout", holeLabels: [], players: [],
};
const details: CourseDetails = { courseId: "456", location: { latitude: 60.2, longitude: 24.5 }, rating: null, holes: [] };

function metrix(overrides: Partial<MetrixClient> = {}): MetrixClient {
  return {
    getRound: vi.fn(),
    getCourseDetails: vi.fn().mockResolvedValue({ kind: "unconfigured" }),
    getCourseStatistics: vi.fn().mockResolvedValue({ kind: "not-found" }),
    findCourseLocation: vi.fn().mockResolvedValue({ kind: "found", location: { latitude: 61, longitude: 25, city: "Veikkola" } }),
    ...overrides,
  };
}

beforeEach(() => mocks.fetchCurrentWeather.mockReset().mockResolvedValue({ kind: "observed", observation }));

describe("round course data", () => {
  it("fetches the course once per round", async () => {
    const client = metrix({ getCourseDetails: vi.fn().mockResolvedValue({ kind: "found", details }) });
    const course = new RoundCourseData(client, "123", () => round);
    expect(await course.info()).toEqual({ details, statistics: null });
    await course.info();
    expect(client.getCourseDetails).toHaveBeenCalledTimes(1);
  });

  it("takes the weather at the layout's own coordinates when it has them", async () => {
    const client = metrix({ getCourseDetails: vi.fn().mockResolvedValue({ kind: "found", details }) });
    expect(await new RoundCourseData(client, "123", () => round).weather()).toBe(observation);
    expect(mocks.fetchCurrentWeather).toHaveBeenCalledWith({ latitude: 60.2, longitude: 24.5, city: null });
    expect(client.findCourseLocation).not.toHaveBeenCalled();
  });

  it("falls back to the course list and remembers the location it found", async () => {
    const client = metrix();
    const course = new RoundCourseData(client, "123", () => round);
    await course.weather();
    await course.weather();
    expect(client.findCourseLocation).toHaveBeenCalledTimes(1);
    expect(mocks.fetchCurrentWeather).toHaveBeenLastCalledWith({ latitude: 61, longitude: 25, city: "Veikkola" });
  });

  it("gives no weather or course data when the round has no course id", async () => {
    const client = metrix();
    const course = new RoundCourseData(client, "123", () => ({ ...round, courseId: null }));
    expect(await course.weather()).toBeNull();
    expect(await course.info()).toEqual({ details: null, statistics: null });
    expect(client.getCourseDetails).not.toHaveBeenCalled();
  });
});
