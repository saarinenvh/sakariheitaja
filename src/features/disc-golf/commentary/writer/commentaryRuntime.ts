import Logger from "js-logger";
import { generateStructured, loadPrompt } from "../../../../shared/llm/ollamaClient";
import { BatchCommentaryContext } from "./commentaryContext";
import { BatchCommentaryResult, buildBatchFallback, writeBatchCommentary } from "./commentaryWriter";

export const COMMENTARY_MODEL_OPTIONS = { temperature: 0.9, num_predict: 800, num_ctx: 16384, repeat_penalty: 1.1 };
export const BATCH_PROMPT_FILE = "batch_commentator.md";
const MS_PER_SECOND = 1000;
let systemPrompt: string | undefined;

export async function writeRoundCommentary(context: BatchCommentaryContext): Promise<BatchCommentaryResult> {
  if (process.env.LLM_ENABLED !== "true") {
    return { kind: "fallback", commentary: buildBatchFallback(context), reason: "disabled" };
  }
  systemPrompt ??= loadPrompt(BATCH_PROMPT_FILE);
  const startedAt = Date.now();
  Logger.info(`Commentary: writing a batch for ${context.players.map(brief => brief.playerName).join(", ")}`);
  const result = await writeBatchCommentary(context, systemPrompt,
    (messages, jsonSchema) => generateStructured(messages, jsonSchema, COMMENTARY_MODEL_OPTIONS));
  const outcome = result.kind === "generated" ? "generated" : `fallback (${result.reason})`;
  Logger.info(`Commentary: batch ${outcome} in ${Math.round((Date.now() - startedAt) / MS_PER_SECOND)}s`);
  return result;
}
