import { z } from "zod";
import { getData } from "../../shared/http";
import { parseOrThrow } from "../../util/validation";

const COURSES_LIST_URL = "https://discgolfmetrix.com/api.php?content=courses_list";
const COURSE_LAYOUT_SEPARATORS = ["&rarr;", "→"] as const;
const LATITUDE_LIMIT_DEG = 90;
const LONGITUDE_LIMIT_DEG = 180;

const PARENT_COURSE_TYPE = "1";

const courseSchema = z.object({
  ID: z.string(),
  Name: z.string().nullish(),
  Type: z.string().nullish(),
  Enddate: z.string().nullish(),
  City: z.string().nullish(),
  X: z.string().nullish(),
  Y: z.string().nullish(),
});
const coursesListSchema = z.object({ courses: z.array(courseSchema) });

export type MetrixCourse = z.output<typeof courseSchema>;

export interface CourseLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

export type CourseLocationResult =
  | { kind: "found"; location: CourseLocation }
  | { kind: "not-found" }
  | { kind: "failed"; reason: string };

interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function fetchCourseLocation(
  courseId: string,
  courseName: string,
  countryCode: string,
): Promise<CourseLocationResult> {
  const parentName = buildCourseSearchTerm(courseName);
  if (parentName === null) return { kind: "not-found" };

  const input = await getData<unknown>(buildCoursesListUrl(parentName, countryCode));
  if (input === undefined) return { kind: "failed", reason: "Metrix course list request failed" };

  let courses: MetrixCourse[];
  try {
    courses = parseOrThrow(coursesListSchema, input, "Metrix course list").courses;
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }

  const location = selectCourseLocation(courses, courseId, parentName);
  return location ? { kind: "found", location } : { kind: "not-found" };
}

/** Metrix names layouts "Parent &rarr; Layout"; layouts always sit at their parent course's location. */
export function buildCourseSearchTerm(courseName: string): string | null {
  let parentName = courseName;
  for (const separator of COURSE_LAYOUT_SEPARATORS) {
    parentName = parentName.split(separator)[0];
  }
  const trimmed = parentName.trim();
  return trimmed ? trimmed : null;
}

/** Prefers the round's own course entry, then an active parent course with the same name. */
export function selectCourseLocation(courses: readonly MetrixCourse[], courseId: string, parentName: string): CourseLocation | null {
  const own = courses.find(candidate => candidate.ID === courseId);
  const sameName = courses.filter(candidate => normalizeName(candidate.Name) === normalizeName(parentName));
  const ranked = [...(own ? [own] : []), ...sameName.sort(compareParentCandidates)];
  for (const course of ranked) {
    const coordinates = parseCourseCoordinates(course);
    if (coordinates) return { ...coordinates, city: parseCity(course) };
  }
  return null;
}

export function parseCourseCoordinates(course: MetrixCourse): Coordinates | null {
  const latitude = parseCoordinate(course.X, LATITUDE_LIMIT_DEG);
  const longitude = parseCoordinate(course.Y, LONGITUDE_LIMIT_DEG);
  if (latitude === null || longitude === null) return null;
  // Unset Metrix coordinates can come back as zeros; no course sits at 0,0.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function buildCoursesListUrl(parentName: string, countryCode: string): string {
  const country = encodeURIComponent(countryCode);
  const name = encodeURIComponent(parentName);
  return `${COURSES_LIST_URL}&country_code=${country}&name=${name}`;
}

function parseCoordinate(text: string | null | undefined, limitDeg: number): number | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > limitDeg) return null;
  return value;
}

function parseCity(course: MetrixCourse): string | null {
  const city = course.City?.trim();
  return city ? city : null;
}

function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase("fi");
}

function compareParentCandidates(first: MetrixCourse, second: MetrixCourse): number {
  return rankParentCandidate(first) - rankParentCandidate(second);
}

function rankParentCandidate(course: MetrixCourse): number {
  const ended = course.Enddate?.trim() ? 2 : 0;
  const notParent = course.Type === PARENT_COURSE_TYPE ? 0 : 1;
  return ended + notParent;
}
