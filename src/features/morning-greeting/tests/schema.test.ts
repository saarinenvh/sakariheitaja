import { describe, expect, it } from "vitest";
import { greetingReplyExample, greetingReplySchema } from "../schema";
import { parseOrThrow } from "../../../shared/validation";

describe("the greeting reply schema", () => {
  it("parses its example", () => {
    expect(parseOrThrow(greetingReplySchema, greetingReplyExample, "greeting reply")).toEqual(greetingReplyExample);
  });

  it("takes only a gif word from the list", () => {
    expect(greetingReplySchema.safeParse({ ...greetingReplyExample, gifQuery: "tired person coffee" }).success).toBe(false);
  });
});
