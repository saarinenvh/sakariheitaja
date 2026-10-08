import { OllamaMessage, OllamaOptions } from "../../integrations/ollama/client";
import { moduleLogger } from "../../shared/logger";
import { getRandom } from "../../shared/utils";
import { planComments } from "./phrases";
import { formatPlanSummary, PlanLine } from "./planSummary";
import { buildPlanCommentMessages } from "./prompts";

const log = moduleLogger("games");

/** The model as the comment uses it: messages in, plain text out. */
export type TextModel = (messages: OllamaMessage[]) => Promise<string>;

/** Loose and short, like the heckler. `num_ctx` matches the reader's and the asker's, so Ollama doesn't reload. */
export const PLAN_COMMENT_MODEL_OPTIONS: OllamaOptions = { temperature: 1.0, num_predict: 80, num_ctx: 8192 };

export interface PlanComment {
  source: "model" | "canned";
  text: string;
}

/**
 * Sakke's line about a saved plan: the model's, or a canned one without a model, when it fails or
 * when it says nothing. Never throws. `rules` replaces the prompt for the eval's variants.
 */
export async function writePlanComment(
  plan: PlanLine, creatorName: string, model: TextModel | null, rules?: string,
): Promise<PlanComment> {
  if (!model) return cannedComment();

  try {
    const text = cleanComment(await model(buildPlanCommentMessages(formatPlanSummary(plan), creatorName, rules)));
    if (text) return { source: "model", text };
  } catch (error) {
    log.warn({ day: plan.day, err: error }, "plan comment failed, using a canned one");
  }

  return cannedComment();
}

/** Trimmed, without the quote marks a model sometimes wraps its line in. */
function cleanComment(text: string): string {
  return text.trim().replace(/^["'“”„]+|["'“”„]+$/g, "").trim();
}

function cannedComment(): PlanComment {
  return { source: "canned", text: planComments[getRandom(planComments.length)] };
}
