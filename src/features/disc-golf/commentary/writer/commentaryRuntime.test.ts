import { afterEach, expect, it, vi } from "vitest";
import { generateStructured, loadPrompt } from "../../../../shared/llm/ollamaClient";
import { BatchCommentaryContext } from "./commentaryContext";
import { buildBatchResponseJsonSchema } from "./commentaryWriter";
import { writeRoundCommentary } from "./commentaryRuntime";

vi.mock("../../../../shared/llm/ollamaClient", async importOriginal => {
  const original = await importOriginal<typeof import("../../../../shared/llm/ollamaClient")>();
  return {
    ...original,
    generateStructured: vi.fn().mockResolvedValue(JSON.stringify({
      opening: "Avaus.", players: [{ name: "Testaaja", text: "ÄSSÄ!" }], closing: "Loppu.",
    })),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const context: BatchCommentaryContext = {
  players: [{
    playerName: "Testaaja", courseName: "Test", division: "", event: "scores-recorded",
    changes: [{ kind: "recorded", holeNumber: 1, score: { strokes: 1, relativeToPar: -2, obCount: 0 } }],
    round: { progress: { kind: "observed", completedHoles: 1, totalHoles: 18 }, recordedStrokes: 1,
      recordedRelativeToPar: -2, scores: { underPar: 1, pars: 0, overPar: 0, unknown: 0 } },
    standing: { position: 1, fieldSize: 3, isProvisional: false },
    movementSincePublication: { kind: "unknown" }, limitations: ["play-order-unknown"],
  }],
  standings: [], scorecardTable: null, playOrderKnown: true, leadHistory: null, weather: null, recentMessages: [],
  firstMessage: true, holeFacts: null, courseDifficulty: null, roundRatings: new Map(),
  spokenNames: new Map([["Testaaja", "Testaaja"]]),
};

it("asks for a structured batch reply with the batch prompt and a 16k context", async () => {
  vi.stubEnv("LLM_ENABLED", "true");
  const result = await writeRoundCommentary(context);
  const [messages, jsonSchema, options] = vi.mocked(generateStructured).mock.calls[0];
  expect(messages[0].content).toBe(loadPrompt("batch_commentator.md"));
  expect(jsonSchema).toEqual(buildBatchResponseJsonSchema(["Testaaja"]));
  expect(options).toMatchObject({ num_ctx: 16384 });
  expect(result).toMatchObject({ kind: "generated", commentary: { opening: "Avaus.", closing: "Loppu." } });
});

it("does not invoke the model when commentary generation is disabled", async () => {
  vi.stubEnv("LLM_ENABLED", "false");
  expect(await writeRoundCommentary(context)).toMatchObject({ kind: "fallback", reason: "disabled" });
  expect(generateStructured).not.toHaveBeenCalled();
});
