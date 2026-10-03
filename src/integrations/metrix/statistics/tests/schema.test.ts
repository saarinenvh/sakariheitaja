import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../../shared/validation";
import { courseStatisticsExample, courseStatisticsSchema, holeResultCountsExample, holeResultCountsSchema } from "../schema";

describe("Metrix course statistics schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(holeResultCountsSchema, holeResultCountsExample, "hole result counts example")).not.toThrow();
    expect(() => parseOrThrow(courseStatisticsSchema, courseStatisticsExample, "course statistics example")).not.toThrow();
  });
});
