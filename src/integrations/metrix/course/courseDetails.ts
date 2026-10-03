import { getData } from "../../../shared/http";
import { parseOrThrow } from "../../../shared/validation";
import { courseErrorsSchema, courseResponseSchema, MetrixBasket, MetrixValue } from "./schema";

const COURSE_API_URL = "https://discgolfmetrix.com/api.php?content=course";
const METRES_PER_FOOT = 0.3048;
const LATITUDE_LIMIT_DEG = 90;
const LONGITUDE_LIMIT_DEG = 180;
const LENGTH_UNITS = { metres: "m", feet: "ft" } as const;
const REDACTED_CODE = "[redacted]";

export interface CourseCoordinates {
  latitude: number;
  longitude: number;
}

/** Two (rating, strokes) points; a round's rating is linear through them. */
export interface CourseRatingAnchors {
  value1: number;
  result1: number;
  value2: number;
  result2: number;
}

export interface CourseHoleDetails {
  label: string;
  par: number | null;
  lengthM: number | null;
  tee: CourseCoordinates | null;
  basket: CourseCoordinates | null;
}

/** A layout from the course API. Community-edited, so everything but `courseId` may be missing. */
export interface CourseDetails {
  courseId: string;
  location: CourseCoordinates | null;
  rating: CourseRatingAnchors | null;
  holes: CourseHoleDetails[];
}

/** `failed` covers a failed request, an API error and an unparseable payload; the reason never contains the code. */
export type CourseDetailsResult =
  | { kind: "found"; details: CourseDetails }
  | { kind: "failed"; reason: string };

export async function fetchCourseDetails(courseId: string, integrationCode: string): Promise<CourseDetailsResult> {
  const input = await getData(buildCourseUrl(courseId, integrationCode));
  if (input === undefined) return { kind: "failed", reason: "Metrix course request failed" };

  const apiErrors = readApiErrors(input);
  if (apiErrors.length > 0) {
    const reason = `Metrix course API error: ${apiErrors.join("; ")}`;
    return { kind: "failed", reason: redactCode(reason, integrationCode) };
  }

  try {
    return { kind: "found", details: parseCourseDetails(input, courseId) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "failed", reason: redactCode(reason, integrationCode) };
  }
}

/** Metrix course data is community-maintained, so every field except the course object itself is optional. */
export function parseCourseDetails(input: unknown, courseId: string): CourseDetails {
  const response = parseOrThrow(courseResponseSchema, input, "Metrix course");
  const { course } = response;
  return {
    courseId,
    location: parseCoordinates(course.Lat, course.Lng),
    rating: parseRatingAnchors(course.RatingValue1, course.RatingResult1, course.RatingValue2, course.RatingResult2),
    holes: (response.baskets ?? []).map(parseHole),
  };
}

function buildCourseUrl(courseId: string, integrationCode: string): string {
  return `${COURSE_API_URL}&id=${encodeURIComponent(courseId)}&code=${encodeURIComponent(integrationCode)}`;
}

function readApiErrors(input: unknown): string[] {
  const result = courseErrorsSchema.safeParse(input);
  if (!result.success) return [];
  return result.data.Errors ?? [];
}

function redactCode(text: string, integrationCode: string): string {
  if (!integrationCode) return text;
  return text.split(integrationCode).join(REDACTED_CODE);
}

function parseHole(basket: MetrixBasket, index: number): CourseHoleDetails {
  return {
    label: parseHoleLabel(basket, index),
    par: parsePositiveInteger(basket.Par),
    lengthM: parseLengthM(basket.Length, basket.Unit),
    tee: parseCoordinates(basket.TeeLat, basket.TeeLng),
    basket: parseCoordinates(basket.BasketLat, basket.BasketLng),
  };
}

function parseHoleLabel(basket: MetrixBasket, index: number): string {
  const alternative = readText(basket.NumberAlt);
  if (alternative) return alternative;
  const number = readText(basket.Number);
  if (number) return number;
  return String(index + 1);
}

function parseLengthM(length: MetrixValue, unit: MetrixValue): number | null {
  const value = parseNumber(length);
  if (value === null || value <= 0) return null;
  const unitText = readText(unit)?.toLowerCase() ?? LENGTH_UNITS.metres;
  if (unitText === LENGTH_UNITS.metres) return value;
  if (unitText === LENGTH_UNITS.feet) return Math.round(value * METRES_PER_FOOT);
  return null;
}

function parseRatingAnchors(
  value1: MetrixValue,
  result1: MetrixValue,
  value2: MetrixValue,
  result2: MetrixValue,
): CourseRatingAnchors | null {
  const anchors = {
    value1: parseNumber(value1),
    result1: parseNumber(result1),
    value2: parseNumber(value2),
    result2: parseNumber(result2),
  };
  if (anchors.value1 === null || anchors.result1 === null || anchors.value2 === null || anchors.result2 === null) return null;
  // Two anchors with the same result define no rating slope.
  if (anchors.result1 === anchors.result2) return null;
  return { value1: anchors.value1, result1: anchors.result1, value2: anchors.value2, result2: anchors.result2 };
}

function parseCoordinates(latitudeValue: MetrixValue, longitudeValue: MetrixValue): CourseCoordinates | null {
  const latitude = parseNumber(latitudeValue);
  const longitude = parseNumber(longitudeValue);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > LATITUDE_LIMIT_DEG || Math.abs(longitude) > LONGITUDE_LIMIT_DEG) return null;
  // Unset Metrix coordinates can come back as zeros; no course sits at 0,0.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function parsePositiveInteger(value: MetrixValue): number | null {
  const parsed = parseNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseNumber(value: MetrixValue): number | null {
  const text = readText(value);
  if (text === null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function readText(value: MetrixValue): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}
