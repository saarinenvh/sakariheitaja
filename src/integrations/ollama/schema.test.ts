import { describe, expect, it } from "vitest";
import { parseOrThrow } from "../../shared/validation";
import { chatResponseExample, chatResponseSchema } from "./schema";

describe("Ollama schemas", () => {
  it("accept their examples", () => {
    expect(() => parseOrThrow(chatResponseSchema, chatResponseExample, "Ollama chat response example")).not.toThrow();
  });
});
