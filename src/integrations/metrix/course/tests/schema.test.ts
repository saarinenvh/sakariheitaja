import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../../shared/validation";
import { courseErrorsExample, courseErrorsSchema, courseExample, courseResponseSchema } from "../schema";

describe("Metrix course schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(courseResponseSchema, courseExample, "Metrix course example")).not.toThrow();
    expect(() => parseOrThrow(courseErrorsSchema, courseErrorsExample, "Metrix course errors example")).not.toThrow();
  });
});
