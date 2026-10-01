import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseStatistics, fetchCourseStatistics, parseCourseStatisticsHtml, parseStoredCourseStatistics } from "./courseStatistics";
import { ValidationError } from "../../../util/validation";

const COUNT_ROWS = ["Hole in one", "Eagle -2", "Birdie -1", "Par 0", "Bogey 1", "Double Bogey 2", "Triple Bogey 3", "Other >3"];

function cells(values: readonly string[]): string {
  return values.map(value => `<td class="center">${value}</td>`).join("");
}

function row(label: string, values: readonly string[]): string {
  return `<tr><td nowrap="nowrap" style="text-align: left">${label}</td>${cells(values)}<td class="total">x</td><td class="total"> </td></tr>`;
}

interface PageOptions {
  header?: string;
  rows?: readonly string[];
}

const defaultRows = [
  row("Par", ["3", "3", "5"]),
  row("Avg", ["3.1", "4.1", "5.0"]),
  row("Difficulty", ["1", "3", "2"]),
  row(COUNT_ROWS[0], ["2", "", ""]),
  row(COUNT_ROWS[1], ["", "", "1"]),
  row(COUNT_ROWS[2], ["10", "1", "3"]),
  row(COUNT_ROWS[3], ["50", "20", "30"]),
  row(COUNT_ROWS[4], ["8", "25", "9"]),
  row(COUNT_ROWS[5], ["1", "10", "2"]),
  row(COUNT_ROWS[6], ["", "4", ""]),
  row(COUNT_ROWS[7], ["", "2", "1"]),
];

const defaultHeader = "<tr><th>&nbsp;</th><th>&nbsp;1&nbsp;</th><th>&nbsp;2&nbsp;</th><th>3A</th><th>Tot</th><td class=\"total\">%</td></tr>";

function buildPage({ header = defaultHeader, rows = defaultRows }: PageOptions = {}): string {
  return `<html><body><div class="hs hs-3" id="hole-stats-table-container" style="display: none;">`
    + `<table class="data"><thead>${header}</thead><tbody>${rows.join("")}</tbody></table></div></body></html>`;
}

describe("course statistics page parsing", () => {
  it("reads per-hole par, average, difficulty rank and result counts", () => {
    const statistics = parseCourseStatisticsHtml(buildPage());

    expect(statistics?.holes.map(hole => hole.label)).toEqual(["1", "2", "3A"]);
    expect(statistics?.holes[1]).toEqual({
      label: "2",
      par: 3,
      averageStrokes: 4.1,
      difficultyRank: 3,
      counts: { aces: 0, eagles: 0, birdies: 1, pars: 20, bogeys: 25, doubleBogeys: 10, tripleBogeys: 4, worse: 2 },
    });
    expect(statistics?.holes[0].counts?.aces).toBe(2);
    expect(statistics?.holes[2]).toMatchObject({ par: 5, averageStrokes: 5, difficultyRank: 2 });
  });

  it("keeps averages and ranks when the count rows or par row are missing", () => {
    const rows = [row("Avg", ["3.1", "4.1", "5.0"]), row("Difficulty", ["1", "3", "2"])];

    const statistics = parseCourseStatisticsHtml(buildPage({ rows }));

    expect(statistics?.holes[0]).toEqual({ label: "1", par: null, averageStrokes: 3.1, difficultyRank: 1, counts: null });
  });

  it("leaves a hole's blank average or rank as null", () => {
    const rows = defaultRows.map(line => line.includes(">Avg<") ? row("Avg", ["", "4.1", "5.0"]) : line);

    expect(parseCourseStatisticsHtml(buildPage({ rows }))?.holes[0].averageStrokes).toBeNull();
  });

  it("returns null when the page no longer has the expected table", () => {
    expect(parseCourseStatisticsHtml("<html><body>No statistics</body></html>")).toBeNull();
    expect(parseCourseStatisticsHtml(buildPage({ rows: defaultRows.filter(line => !line.includes(">Difficulty<")) }))).toBeNull();
    expect(parseCourseStatisticsHtml(buildPage({ header: "<tr><th>&nbsp;</th><th>1</th><th>2</th><th>3</th></tr>" }))).toBeNull();
  });

  it("returns null when a row does not line up with the header", () => {
    const rows = [...defaultRows, row("Avg", ["3.1", "4.1"])];

    expect(parseCourseStatisticsHtml(buildPage({ rows }))).toBeNull();
  });
});

describe("course statistics fetching", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the public course page and parses its statistics", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(buildPage(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCourseStatistics("35014");

    expect(fetchMock.mock.calls[0][0]).toBe("https://discgolfmetrix.com/course/35014");
    expect(result.kind).toBe("found");
  });

  it("reports a page without the table as not found", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("<html></html>", { status: 200 })));

    expect(await fetchCourseStatistics("35014")).toEqual({ kind: "not-found" });
  });

  it("reports HTTP and network failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 })));
    expect(await fetchCourseStatistics("35014")).toEqual({ kind: "failed", reason: "Metrix course page returned HTTP 503" });

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("socket hang up")));
    expect(await fetchCourseStatistics("35014")).toMatchObject({ kind: "failed" });
  });
});

describe("stored course statistics", () => {
  it("accepts statistics produced by the page parser", () => {
    const statistics = parseCourseStatisticsHtml(buildPage());

    expect(parseStoredCourseStatistics(JSON.parse(JSON.stringify(statistics)))).toEqual(statistics);
  });

  it("rejects a malformed stored shape", () => {
    const malformed: unknown = { holes: [{ label: "1", par: "3", averageStrokes: 3, difficultyRank: 1, counts: null }] };
    const empty: CourseStatistics = { holes: [] };

    expect(() => parseStoredCourseStatistics(malformed)).toThrow(ValidationError);
    expect(parseStoredCourseStatistics(empty)).toEqual(empty);
  });
});
