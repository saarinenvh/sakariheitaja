import { describe, expect, it, vi } from "vitest";
import { GREETING_MODEL_OPTIONS, writeGreeting } from "../greetingWriter";
import { GreetingFacts } from "../facts";
import { greetingReplyJsonSchema } from "../schema";
import { OllamaClient } from "../../../integrations/ollama/client";

const facts: GreetingFacts = {
  weekday: "maanantai", date: "2026-10-12",
  weather: { town: "Tampere", temperatureC: 4, windMs: 9, description: "kovaa sadetta" }, todaysGames: [],
  recentGreetings: ["Aamuja, sankarit! Eilen satoi."],
};

function ollamaReplying(reply: string | Error) {
  const generateStructured = vi.fn<OllamaClient["generateStructured"]>();
  if (reply instanceof Error) generateStructured.mockRejectedValue(reply);
  else generateStructured.mockResolvedValue(reply);

  return { generate: vi.fn<OllamaClient["generate"]>(), generateStructured } satisfies OllamaClient;
}

describe("writeGreeting", () => {
  it("returns Sakke's greeting and gif word, asking with the facts, the schema and the greeting's options", async () => {
    const ollama = ollamaReplying(JSON.stringify({ text: "Tampereella sataa vaakatasossa.", gifQuery: "rain" }));

    const result = await writeGreeting(ollama, facts, true);

    expect(result).toEqual({ kind: "generated", reply: { text: "Tampereella sataa vaakatasossa.", gifQuery: "rain" } });
    const [messages, jsonSchema, options] = ollama.generateStructured.mock.calls[0];
    expect(messages[0].content).toContain("Olet Sakke.");
    expect(messages[0].content).toContain("aamutervehdys");
    expect(JSON.parse(messages[1].content)).toEqual(facts);
    expect(jsonSchema).toBe(greetingReplyJsonSchema);
    expect(options).toBe(GREETING_MODEL_OPTIONS);
  });

  it("asks with a given system prompt instead of the real one, for the eval harness", async () => {
    const ollama = ollamaReplying(JSON.stringify({ text: "Huomenta.", gifQuery: "morning" }));

    await writeGreeting(ollama, facts, true, "Variant prompt");

    expect(ollama.generateStructured.mock.calls[0][0][0].content).toBe("Variant prompt");
  });

  it("removes stray quote marks around the text", async () => {
    const ollama = ollamaReplying(JSON.stringify({ text: "“Huomenta vaan.” \n", gifQuery: "morning" }));

    const result = await writeGreeting(ollama, facts, true);

    expect(result).toEqual({ kind: "generated", reply: { text: "Huomenta vaan.", gifQuery: "morning" } });
  });

  it("doesn't call the model when it's off", async () => {
    const ollama = ollamaReplying("{}");

    await expect(writeGreeting(ollama, facts, false)).resolves.toEqual({ kind: "fallback", reason: "disabled" });
    expect(ollama.generateStructured).not.toHaveBeenCalled();
  });

  it("falls back when the call fails", async () => {
    const ollama = ollamaReplying(new Error("Ollama timed out"));

    await expect(writeGreeting(ollama, facts, true)).resolves.toEqual({ kind: "fallback", reason: "generation-failed" });
  });

  it.each([
    ["not JSON", "Huomenta!"],
    ["a gif word outside the list", JSON.stringify({ text: "Huomenta!", gifQuery: "tired person drinking coffee" })],
    ["nothing but quote marks", JSON.stringify({ text: " ”” ", gifQuery: "rain" })],
  ])("falls back on a reply that is %s", async (_case, reply) => {
    await expect(writeGreeting(ollamaReplying(reply), facts, true)).resolves.toEqual({ kind: "fallback", reason: "unusable-response" });
  });
});
