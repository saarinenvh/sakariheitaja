import { MetrixClient } from "../../integrations/metrix/client";
import { CourseDetails } from "../../integrations/metrix/course/courseDetails";
import { CourseLocationResult } from "../../integrations/metrix/location/courseLocation";
import { MetrixRound } from "../../integrations/metrix/round/types";
import { CourseStatistics } from "../../integrations/metrix/statistics/courseStatistics";
import { CourseInfo } from "../commentary/facts/courseCommentaryFacts";
import { moduleLogger } from "../../shared/logger";
import { OpenWeatherClient, WeatherObservation } from "../../integrations/openweather/client";

const log = moduleLogger("course-data");

/**
 * The followed round's course: layout details and statistics, fetched once, and the current weather at the course.
 * Nothing here throws; a part Metrix or the weather service can't provide is null.
 */
export class RoundCourseData {
  private courseInfo: Promise<CourseInfo> | null = null;
  private courseLocation: CourseLocationResult | null = null;

  constructor(
    private readonly metrix: MetrixClient,
    private readonly openWeather: OpenWeatherClient,
    private readonly metrixId: string,
    private readonly currentRound: () => MetrixRound | null,
  ) {}

  info(): Promise<CourseInfo> {
    this.courseInfo ??= this.loadCourseInfo();
    return this.courseInfo;
  }

  /** The layout's coordinates when it has them, else the parent course's from the course list (remembered). */
  async weather(): Promise<WeatherObservation | null> {
    const round = this.currentRound();
    if (!round?.courseId) return null;
    const layoutLocation = (await this.info()).details?.location ?? null;
    const location = layoutLocation ? { kind: "found" as const, location: { ...layoutLocation, city: null } } : this.courseLocation
      ?? await this.metrix.findCourseLocation(round.courseId, round.courseName);
    if (!layoutLocation && location.kind !== "failed") this.courseLocation = location;
    if (location.kind !== "found") {
      log.warn({ metrixId: this.metrixId, location: location.kind }, "no course location for weather");
      return null;
    }
    const weather = await this.openWeather.getCurrentWeather(location.location);
    if (weather.kind === "failed") {
      log.warn({ metrixId: this.metrixId, reason: weather.reason }, "weather unavailable");
      return null;
    }
    const { temperatureC, description } = weather.observation;
    log.info({ metrixId: this.metrixId, temperatureC, description }, "weather observed");
    return weather.observation;
  }

  private async loadCourseInfo(): Promise<CourseInfo> {
    const courseId = this.currentRound()?.courseId;
    if (!courseId) return { details: null, statistics: null };
    const [details, statistics] = await Promise.all([
      this.loadCourseDetails(courseId).catch(error => this.reportCourseDataFailure("details", error)),
      this.loadCourseStatistics(courseId).catch(error => this.reportCourseDataFailure("statistics", error)),
    ]);
    log.info({ metrixId: this.metrixId }, `course data ${details ? "with" : "without"} layout details, ${statistics ? "with" : "without"} statistics`);
    return { details, statistics };
  }

  private reportCourseDataFailure(part: string, error: unknown): null {
    log.warn({ metrixId: this.metrixId, err: error }, `course ${part} unavailable`);
    return null;
  }

  private async loadCourseDetails(courseId: string): Promise<CourseDetails | null> {
    const result = await this.metrix.getCourseDetails(courseId);
    if (result.kind === "found") return result.details;
    if (result.kind === "unconfigured") return null;
    log.warn({ metrixId: this.metrixId, reason: result.reason }, "course details unavailable");
    return null;
  }

  private async loadCourseStatistics(courseId: string): Promise<CourseStatistics | null> {
    const result = await this.metrix.getCourseStatistics(courseId);
    if (result.kind === "found") return result.statistics;
    if (result.kind === "failed") log.warn({ metrixId: this.metrixId, reason: result.reason }, "course statistics unavailable");
    return null;
  }
}
