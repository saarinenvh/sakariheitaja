import { describe, expect, it } from "vitest";
import { formatCourseResults } from "../scoreRecords";
import { scoreRecordMessages as MSG } from "../messages";

describe("formatCourseResults", () => {
  it("lists the ten best results, with names escaped for HTML", () => {
    const results = Array.from({ length: 12 }, (_, index) => ({ player: index === 0 ? "Jori <3" : `Pelaaja ${index}`, relativeToPar: index - 3, strokes: 51 + index }));

    const html = formatCourseResults({ kind: "results", course: "Kaatis & co", results });

    expect(html).toContain("Kaatis &amp; co");
    expect(html).toContain("1\t\t\t\tJori &lt;3\t\t\t\t-3");
    expect(html).toContain("10\t\t\t\tPelaaja 9\t\t\t\t6");
    expect(html).not.toContain("Pelaaja 10");
  });

  it("asks which course by id when several match", () => {
    const html = formatCourseResults({ kind: "ambiguous-course", courses: [{ id: 3, name: "Kaatis A" }, { id: 4, name: "Kaatis <B>" }] });

    expect(html).toContain("<b>3</b>: Kaatis A\n<b>4</b>: Kaatis &lt;B&gt;");
  });

  it("says there are no results for an unknown course or a course without results", () => {
    expect(formatCourseResults({ kind: "not-found" })).toBe(MSG.noResults);
    expect(formatCourseResults({ kind: "results", course: "Kaatis", results: [] })).toBe(MSG.noResults);
  });
});
