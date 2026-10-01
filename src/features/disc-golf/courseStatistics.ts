import Logger from "js-logger";
import { z } from "zod";
import { parseOrThrow } from "../../util/validation";

const COURSE_PAGE_URL = "https://discgolfmetrix.com/course/";
const COURSE_PAGE_TIMEOUT_MS = 10_000;
const REQUEST_HEADERS = { "User-Agent": "SakariHeitajaBot/1.0 (disc golf commentary bot)" };
const STATISTICS_CONTAINER_ID = 'id="hole-stats-table-container"';
const TOTAL_COLUMN_LABEL = "Tot";

const ROW_LABELS = {
  par: "Par",
  average: "Avg",
  difficulty: "Difficulty",
} as const;

const COUNT_ROW_LABELS = {
  aces: "Hole in one",
  eagles: "Eagle -2",
  birdies: "Birdie -1",
  pars: "Par 0",
  bogeys: "Bogey 1",
  doubleBogeys: "Double Bogey 2",
  tripleBogeys: "Triple Bogey 3",
  worse: "Other >3",
} as const;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

export interface HoleResultCounts {
  aces: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  tripleBogeys: number;
  worse: number;
}

export interface CourseHoleStatistics {
  label: string;
  par: number | null;
  averageStrokes: number | null;
  /** 1 = easiest hole on the course, hole count = hardest. */
  difficultyRank: number | null;
  counts: HoleResultCounts | null;
}

export interface CourseStatistics {
  holes: CourseHoleStatistics[];
}

export type CourseStatisticsResult =
  | { kind: "found"; statistics: CourseStatistics }
  | { kind: "not-found" }
  | { kind: "failed"; reason: string };

const countSchema = z.number().int().nonnegative();

const holeResultCountsSchema = z.object({
  aces: countSchema,
  eagles: countSchema,
  birdies: countSchema,
  pars: countSchema,
  bogeys: countSchema,
  doubleBogeys: countSchema,
  tripleBogeys: countSchema,
  worse: countSchema,
}) satisfies z.ZodType<HoleResultCounts>;

const courseStatisticsSchema = z.object({
  holes: z.array(z.object({
    label: z.string(),
    par: z.number().int().positive().nullable(),
    averageStrokes: z.number().positive().nullable(),
    difficultyRank: z.number().int().positive().nullable(),
    counts: holeResultCountsSchema.nullable(),
  })),
}) satisfies z.ZodType<CourseStatistics>;

type CountKey = keyof HoleResultCounts;
type TableRows = ReadonlyMap<string, readonly string[]>;

export async function fetchCourseStatistics(courseId: string): Promise<CourseStatisticsResult> {
  const page = await fetchCoursePage(courseId);
  if (page.kind === "failed") return page;

  const statistics = parseCourseStatisticsHtml(page.html);
  return statistics ? { kind: "found", statistics } : { kind: "not-found" };
}

/** Returns null when the page no longer has the expected statistics table. */
export function parseCourseStatisticsHtml(html: string): CourseStatistics | null {
  const table = extractStatisticsTable(html);
  if (table === null) return null;

  const [header, ...bodyRows] = extractRows(table);
  if (header === undefined) return null;
  const holeLabels = parseHoleLabels(header);
  if (holeLabels === null) return null;

  const rows = indexRowsByLabel(bodyRows, header.length);
  if (rows === null) return null;
  const averages = rows.get(ROW_LABELS.average);
  const difficulties = rows.get(ROW_LABELS.difficulty);
  if (averages === undefined || difficulties === undefined) return null;
  const pars = rows.get(ROW_LABELS.par);

  const holes = holeLabels.map((label, index): CourseHoleStatistics => ({
    label,
    par: parsePositiveInteger(pars?.[index]),
    averageStrokes: parsePositiveNumber(averages[index]),
    difficultyRank: parsePositiveInteger(difficulties[index]),
    counts: parseResultCounts(rows, index),
  }));
  return { holes };
}

export function parseStoredCourseStatistics(input: unknown): CourseStatistics {
  return parseOrThrow(courseStatisticsSchema, input, "stored course statistics");
}

type CoursePageResult = { kind: "fetched"; html: string } | { kind: "failed"; reason: string };

async function fetchCoursePage(courseId: string): Promise<CoursePageResult> {
  const url = `${COURSE_PAGE_URL}${encodeURIComponent(courseId)}`;
  try {
    const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(COURSE_PAGE_TIMEOUT_MS) });
    if (!response.ok) return { kind: "failed", reason: `Metrix course page returned HTTP ${response.status}` };
    return { kind: "fetched", html: await response.text() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`fetchCourseStatistics ${url} failed: ${message}`);
    return { kind: "failed", reason: `Metrix course page request failed: ${message}` };
  }
}

function extractStatisticsTable(html: string): string | null {
  const containerStart = html.indexOf(STATISTICS_CONTAINER_ID);
  if (containerStart === -1) return null;
  const tableStart = html.indexOf("<table", containerStart);
  if (tableStart === -1) return null;
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd === -1) return null;
  return html.slice(tableStart, tableEnd);
}

function extractRows(table: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      cells.push(readCellText(cellMatch[2]));
    }
    rows.push(cells);
  }
  return rows;
}

/** The header is a blank corner cell, one cell per hole, then total and percentage columns. */
function parseHoleLabels(header: readonly string[]): string[] | null {
  const totalIndex = header.indexOf(TOTAL_COLUMN_LABEL);
  if (totalIndex === -1) return null;
  const holeLabels = header.slice(1, totalIndex);
  if (holeLabels.length === 0 || holeLabels.some(label => label === "")) return null;
  return holeLabels;
}

/** Maps each row name to its hole cells; null if any row is misaligned with the header. */
function indexRowsByLabel(bodyRows: readonly string[][], headerLength: number): TableRows | null {
  const rows = new Map<string, string[]>();
  for (const row of bodyRows) {
    if (row.length !== headerLength) return null;
    const [label, ...holeCells] = row;
    rows.set(label, holeCells);
  }
  return rows;
}

function parseResultCounts(rows: TableRows, holeIndex: number): HoleResultCounts | null {
  const counts: Partial<HoleResultCounts> = {};
  for (const [key, rowLabel] of Object.entries(COUNT_ROW_LABELS) as [CountKey, string][]) {
    const row = rows.get(rowLabel);
    if (row === undefined) return null;
    const count = parseCount(row[holeIndex]);
    if (count === null) return null;
    counts[key] = count;
  }
  const result = holeResultCountsSchema.safeParse(counts);
  return result.success ? result.data : null;
}

/** Metrix leaves a count cell empty when nobody got that result. */
function parseCount(cell: string): number | null {
  if (cell === "") return 0;
  const value = Number(cell);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parsePositiveInteger(cell: string | undefined): number | null {
  const value = parsePositiveNumber(cell);
  return value !== null && Number.isInteger(value) ? value : null;
}

function parsePositiveNumber(cell: string | undefined): number | null {
  if (!cell) return null;
  const value = Number(cell);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readCellText(cellHtml: string): string {
  const withoutTags = cellHtml.replace(/<[^>]*>/g, "");
  return decodeHtmlEntities(withoutTags).trim();
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
  });
}
