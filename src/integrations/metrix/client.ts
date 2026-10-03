import { getData } from "../../shared/http";
import { CourseDetailsResult, fetchCourseDetails } from "./course/courseDetails";
import { CourseLocationResult, fetchCourseLocation } from "./location/courseLocation";
import { parseMetrixRound } from "./round/normalize";
import { MetrixRound } from "./round/types";
import { CourseStatisticsResult, fetchCourseStatistics } from "./statistics/courseStatistics";

const RESULT_API_URL = "https://discgolfmetrix.com/api.php?content=result&id=";

export interface MetrixClientConfig {
  /** Personal integration code for the course API; without it, course details are `unconfigured`. */
  integrationCode: string | undefined;
  /** Country for the course-list search that locates a course for the weather. */
  commentaryCountryCode: string;
}

/**
 * - `fetched`: the round, normalized.
 * - `invalid`: Metrix answered with a payload that doesn't parse; `error` is the `ValidationError`,
 *   or `UnsupportedRoundError` for an event or series.
 * - `unavailable`: the request failed (network, timeout, HTTP error, not JSON).
 */
export type RoundFetchResult =
  | { kind: "fetched"; round: MetrixRound }
  | { kind: "invalid"; error: unknown }
  | { kind: "unavailable" };

export type CourseDetailsFetchResult = CourseDetailsResult | { kind: "unconfigured" };

/** Everything the bot reads from Disc Golf Metrix. Never throws; failures come back as result variants. */
export interface MetrixClient {
  getRound(roundId: string): Promise<RoundFetchResult>;
  /** Layout from the course API: par, length and tee/basket coordinates per hole, and rating anchors. */
  getCourseDetails(courseId: string): Promise<CourseDetailsFetchResult>;
  /** Historical hole statistics scraped from the public course page. */
  getCourseStatistics(courseId: string): Promise<CourseStatisticsResult>;
  /** The parent course's coordinates from the course list, for the weather when the layout has none. */
  findCourseLocation(courseId: string, courseName: string): Promise<CourseLocationResult>;
}

export function createMetrixClient(config: MetrixClientConfig): MetrixClient {
  return {
    getRound: async roundId => {
      const payload = await getData(`${RESULT_API_URL}${encodeURIComponent(roundId)}`);
      return payload === undefined ? { kind: "unavailable" } : readRoundPayload(payload, roundId);
    },
    getCourseDetails: async courseId => {
      if (!config.integrationCode) return { kind: "unconfigured" };
      return fetchCourseDetails(courseId, config.integrationCode);
    },
    getCourseStatistics: courseId => fetchCourseStatistics(courseId),
    findCourseLocation: (courseId, courseName) => fetchCourseLocation(courseId, courseName, config.commentaryCountryCode),
  };
}

/** Parses a fetched result payload; exported for replays (tests, the eval harness) that already hold one. */
export function readRoundPayload(payload: unknown, roundId: string): RoundFetchResult {
  try {
    return { kind: "fetched", round: parseMetrixRound(payload, roundId) };
  } catch (error) {
    return { kind: "invalid", error };
  }
}
