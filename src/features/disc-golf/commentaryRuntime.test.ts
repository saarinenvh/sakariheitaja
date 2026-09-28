import { afterEach, expect, it, vi } from "vitest";
import { generate, loadPrompt } from "../../shared/llm/ollamaClient";
import { writeRoundCommentary } from "./commentaryRuntime";
import { CommentaryPromptContext } from "./commentaryWriter";

vi.mock("../../shared/llm/ollamaClient", async importOriginal => {
  const original = await importOriginal<typeof import("../../shared/llm/ollamaClient")>();
  return { ...original, generate: vi.fn().mockResolvedValue("Testaaja, ässä!") };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const context: CommentaryPromptContext = {
  factualBrief: {
    playerName: "Testaaja", courseName: "Test", division: "", event: "scores-recorded",
    changes: [{ kind: "recorded", holeNumber: 1, score: { strokes: 1, relativeToPar: -2, obCount: 0 } }],
    round: { progress: { kind: "observed", completedHoles: 1, totalHoles: 18 }, recordedStrokes: 1,
      recordedRelativeToPar: -2, scores: { underPar: 1, pars: 0, overPar: 0, unknown: 0 } },
    standing: { position: 1, fieldSize: 3, isProvisional: false },
    movementSincePublication: { kind: "unknown" }, limitations: ["play-order-unknown"],
  }, narrativeHistory: [], competitionFacts: [],
};

it("loads vocabulary inspiration before the task's factual and length rules", async () => {
  vi.stubEnv("LLM_ENABLED", "true");
  await writeRoundCommentary(context);
  expect(vi.mocked(generate).mock.calls[0][0][0].content).toBe(
    ["persona.md", "disc_golf_vocabulary.md", "commentator.md"].map(loadPrompt).join("\n\n---\n\n"),
  );
  expect(vi.mocked(generate).mock.calls[0][1]).toMatchObject({ num_ctx: 16384 });
});

it("does not invoke the model when commentary generation is disabled", async () => {
  vi.stubEnv("LLM_ENABLED", "false");
  expect(await writeRoundCommentary(context)).toMatchObject({ kind: "fallback", reason: "disabled" });
  expect(generate).not.toHaveBeenCalled();
});
