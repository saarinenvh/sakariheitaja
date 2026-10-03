import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/utils", () => ({ getRandom: () => 1 }));
vi.mock("../../../prompts/prompts", () => ({ loadPrompt: () => "Sakke" }));

import { heckle } from "../heckler";
import { sakariResponses } from "../phrases";
import { OllamaClient } from "../../../integrations/ollama/client";

function ollama(): OllamaClient {
  return { generate: vi.fn().mockResolvedValue("Mallin heitto."), generateStructured: vi.fn() };
}

describe("heckle", () => {
  it("never asks the model when the LLM is disabled", async () => {
    const client = ollama();
    expect(sakariResponses).toContain(await heckle(client, -100, "Sakke!", false));
    expect(client.generate).not.toHaveBeenCalled();
  });

  it("may ask the model when the LLM is enabled", async () => {
    const client = ollama();
    expect(await heckle(client, -100, "Sakke!", true)).toBe("Mallin heitto.");
  });
});
