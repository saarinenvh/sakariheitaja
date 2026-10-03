import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../shared/validation";
import { bracketExample, bracketSchema } from "./schema";

describe("Challonge schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(bracketSchema, bracketExample, "Challonge bracket example")).not.toThrow();
  });
});
