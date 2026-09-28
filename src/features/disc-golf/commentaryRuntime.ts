import { generate, loadPrompt } from "../../shared/llm/ollamaClient";
import { buildFactualFallback, CommentaryPromptContext, CommentaryText, writeFactualCommentary } from "./commentaryWriter";

const COMMENTARY_MODEL_OPTIONS = { temperature: 0.9, num_predict: 350, num_ctx: 16384, repeat_penalty: 1.1 };
let systemPrompt: string | undefined;

export async function writeRoundCommentary(context: CommentaryPromptContext): Promise<CommentaryText> {
  if (process.env.LLM_ENABLED !== "true") {
    return { kind: "fallback", text: buildFactualFallback(context.factualBrief), reason: "disabled" };
  }
  systemPrompt ??= ["persona.md", "disc_golf_vocabulary.md", "commentator.md"].map(loadPrompt).join("\n\n---\n\n");
  return writeFactualCommentary(context, systemPrompt, messages => generate(messages, COMMENTARY_MODEL_OPTIONS));
}
