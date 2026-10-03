import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../shared/validation";
import { gifSearchExample, gifSearchSchema } from "./schema";

describe("Giphy schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(gifSearchSchema, gifSearchExample, "Giphy search example")).not.toThrow();
  });
});
