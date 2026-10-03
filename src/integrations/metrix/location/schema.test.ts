import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../../shared/validation";
import { coursesListExample, coursesListSchema } from "./schema";

describe("Metrix course list schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(coursesListSchema, coursesListExample, "Metrix course list example")).not.toThrow();
  });
});
