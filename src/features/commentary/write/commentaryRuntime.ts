import { moduleLogger } from "../../../shared/logger";
import { generateStructured, loadPrompt } from "../../../integrations/ollama/client";
import { BatchCommentaryContext } from "../facts/commentaryContext";
import { readConfig } from "../../../config";
import { BatchCommentaryResult, buildBatchFallback, writeBatchCommentary } from "./commentaryWriter";

const log = moduleLogger("commentary");

export const COMMENTARY_MODEL_OPTIONS = { temperature: 0.9, num_predict: 800, num_ctx: 16384, repeat_penalty: 1.1 };
export const BATCH_PROMPT_FILE = "batch_commentator.md";
const MS_PER_SECOND = 1000;
let systemPrompt: string | undefined;

export async function writeRoundCommentary(context: BatchCommentaryContext): Promise<BatchCommentaryResult> {
  if (!readConfig().llmEnabled) {
    return { kind: "fallback", commentary: buildBatchFallback(context), reason: "disabled" };
  }
  systemPrompt ??= loadPrompt(BATCH_PROMPT_FILE);
  const startedAt = Date.now();
  log.info({ players: context.players.map(brief => brief.playerName) }, "writing a commentary batch");
  const result = await writeBatchCommentary(context, systemPrompt,
    (messages, jsonSchema) => generateStructured(messages, jsonSchema, COMMENTARY_MODEL_OPTIONS));
  const outcome = result.kind === "generated" ? "generated" : `fallback (${result.reason})`;
  log.info({ durationS: Math.round((Date.now() - startedAt) / MS_PER_SECOND) }, `commentary batch ${outcome}`);
  return result;
}
