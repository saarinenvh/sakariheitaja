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

/** A model reply with the three parts; `parts` overrides them. */
function replyJson(parts: Record<string, string> = {}): string {
  return JSON.stringify({
    greeting: "Aamuja, sankarit!", weather: "Tampereella sataa vaakatasossa.", games: "Ei pelejä, laiskurit.", gifQuery: "rain",
    ...parts,
  });
}

function ollamaReplying(reply: string | Error) {
  const generateStructured = vi.fn<OllamaClient["generateStructured"]>();
  if (reply instanceof Error) generateStructured.mockRejectedValue(reply);
  else generateStructured.mockResolvedValue(reply);

  return { generate: vi.fn<OllamaClient["generate"]>(), generateStructured } satisfies OllamaClient;
}

describe("writeGreeting", () => {
  it("returns Sakke's greeting as three paragraphs and the gif word, asking with the facts, the schema and the options", async () => {
    const ollama = ollamaReplying(replyJson());

    const result = await writeGreeting(ollama, facts, true);

    expect(result).toEqual({ kind: "generated", reply: {
      greeting: "Aamuja, sankarit!", weather: "Tampereella sataa vaakatasossa.", games: "Ei pelejä, laiskurit.", gifQuery: "rain",
      text: "Aamuja, sankarit!\n\nTampereella sataa vaakatasossa.\n\nEi pelejä, laiskurit.",
    } });
    const [messages, jsonSchema, options] = ollama.generateStructured.mock.calls[0];
    expect(messages[0].content).toContain("Olet Sakke.");
    expect(messages[0].content).toContain("aamutervehdys");
    expect(JSON.parse(messages[1].content)).toEqual(facts);
    expect(jsonSchema).toBe(greetingReplyJsonSchema);
    expect(options).toBe(GREETING_MODEL_OPTIONS);
  });

  it("asks with a given system prompt instead of the real one, for the eval harness", async () => {
    const ollama = ollamaReplying(replyJson());

    await writeGreeting(ollama, facts, true, "Variant prompt");

    expect(ollama.generateStructured.mock.calls[0][0][0].content).toBe("Variant prompt");
  });

  it("removes stray quote marks around each part", async () => {
    const ollama = ollamaReplying(replyJson({ greeting: "“Huomenta vaan.” \n", weather: "„Sataa.“", games: "\"Ei pelejä.\"" }));

    const result = await writeGreeting(ollama, facts, true);

    expect(result).toMatchObject({ kind: "generated", reply: { text: "Huomenta vaan.\n\nSataa.\n\nEi pelejä." } });
  });

  it("leaves the weather paragraph out when there was no weather, or the model left it empty", async () => {
    const withoutWeather = await writeGreeting(ollamaReplying(replyJson()), { ...facts, weather: null }, true);
    const emptyWeather = await writeGreeting(ollamaReplying(replyJson({ weather: " " })), facts, true);

    for (const result of [withoutWeather, emptyWeather]) {
      expect(result).toMatchObject({ kind: "generated", reply: { weather: null, text: "Aamuja, sankarit!\n\nEi pelejä, laiskurit." } });
    }
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
    ["a gif word outside the list", replyJson({ gifQuery: "tired person drinking coffee" })],
    ["a greeting of nothing but quote marks", replyJson({ greeting: " ”” " })],
    ["a games part of nothing but quote marks", replyJson({ games: " ”” " })],
    ["without the games part", JSON.stringify({ greeting: "Huomenta!", weather: "Sataa.", gifQuery: "rain" })],
  ])("falls back on a reply that is %s", async (_case, reply) => {
    await expect(writeGreeting(ollamaReplying(reply), facts, true)).resolves.toEqual({ kind: "fallback", reason: "unusable-response" });
  });
});
