import { addDays, daysBetween, weekdayOf } from "../../shared/time";

/** What a plan says: the day, the time, and the courses in order. */
export interface PlanDraft {
  /** `YYYY-MM-DD`. */
  day: string;
  /** `HH:MM`, or null. */
  startTime: string | null;
  courses: string[];
}

/** `free-text`: the text doesn't start with a day or a time, so it isn't the fixed form. */
export type FixedFormResult =
  | { kind: "plan"; draft: PlanDraft }
  | { kind: "free-text" }
  | { kind: "no-courses" };

const RELATIVE_DAYS: Readonly<Record<string, number>> = { tänään: 0, huomenna: 1, ylihuomenna: 2 };

/** By `Date.getDay` index: the short form, the name, and the "on that day" form. */
const WEEKDAY_WORDS: readonly (readonly string[])[] = [
  ["su", "sunnuntai", "sunnuntaina"],
  ["ma", "maanantai", "maanantaina"],
  ["ti", "tiistai", "tiistaina"],
  ["ke", "keskiviikko", "keskiviikkona"],
  ["to", "torstai", "torstaina"],
  ["pe", "perjantai", "perjantaina"],
  ["la", "lauantai", "lauantaina"],
];

/** `10.10.` or `10.10.2026`; the trailing dot tells a date from the time `10.10`. */
const DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/;
const TIME_PATTERN = /^(\d{1,2})(?:[.:](\d{2}))?$/;
const CLOCK_WORD = "klo";
const COURSE_SEPARATOR = /\s*[+,]\s*/;

/**
 * Reads `[day] [klo] [time] courses…`: a day word or date, a time, or both first, then the courses
 * split on `+` and `,`. A time without a day is today. `today` is `YYYY-MM-DD`.
 */
export function readFixedForm(text: string, today: string): FixedFormResult {
  const words = text.trim().split(/\s+/);
  let next = 0;

  const day = readDay(words[next], today);
  if (day !== null) next++;
  if (words[next]?.toLowerCase() === CLOCK_WORD) next++;
  const startTime = readTime(words[next]);
  if (startTime !== null) next++;

  if (day === null && startTime === null) return { kind: "free-text" };

  const courses = readCourses(words.slice(next).join(" "));
  if (courses.length === 0) return { kind: "no-courses" };

  return { kind: "plan", draft: { day: day ?? today, startTime, courses } };
}

/** A weekday is its next occurrence, today included; a date without a year that has passed is next year's. */
function readDay(word: string | undefined, today: string): string | null {
  if (word === undefined) return null;
  const lower = word.toLowerCase();

  const relative = RELATIVE_DAYS[lower];
  if (relative !== undefined) return addDays(today, relative);

  const weekday = WEEKDAY_WORDS.findIndex(words => words.includes(lower));
  if (weekday !== -1) return addDays(today, (weekday - weekdayOf(today) + 7) % 7);

  return readDate(lower, today);
}

function readDate(word: string, today: string): string | null {
  const match = DATE_PATTERN.exec(word);
  if (!match) return null;

  const [, date, month, year] = match;
  const thisYear = Number(today.slice(0, 4));
  const day = calendarDay(Number(year ?? thisYear), Number(month), Number(date));
  if (day === null) return null;
  if (year !== undefined || daysBetween(today, day) >= 0) return day;

  return calendarDay(thisYear + 1, Number(month), Number(date));
}

/** `YYYY-MM-DD`, or null for a day the calendar doesn't have (31.2.). */
function calendarDay(year: number, month: number, date: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, date));
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== date) return null;

  return candidate.toISOString().slice(0, 10);
}

function readTime(word: string | undefined): string | null {
  const match = word === undefined ? null : TIME_PATTERN.exec(word);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Each course with its first letter capitalized: "karjaa" is shown as "Karjaa". */
function readCourses(text: string): string[] {
  return text.split(COURSE_SEPARATOR)
    .map(course => course.trim())
    .filter(course => course.length > 0)
    .map(course => course.charAt(0).toLocaleUpperCase("fi") + course.slice(1));
}
