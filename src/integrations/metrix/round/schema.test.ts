import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../shared/validation";
import { roundExample, roundSchema, scorecardExample, scorecardSchema } from "./schema";

describe("Metrix round schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(roundSchema, roundExample, "Metrix round example")).not.toThrow();
    expect(() => parseOrThrow(scorecardSchema, scorecardExample, "Metrix scorecard example")).not.toThrow();
  });
});
