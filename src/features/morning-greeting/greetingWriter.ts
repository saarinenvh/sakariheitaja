import { OllamaClient, OllamaMessage } from "../../integrations/ollama/client";
import { moduleLogger } from "../../shared/logger";
import { GreetingFacts } from "./facts";
import { buildGreetingRequest, greetingSystemPrompt } from "./prompts";
import { GreetingReply, greetingReplyJsonSchema, greetingReplySchema } from "./schema";

const log = moduleLogger("morning-greeter");

export const GREETING_MODEL_OPTIONS = { temperature: 0.8, num_predict: 300, num_ctx: 8192 };

/** Quote marks the model sometimes wraps the greeting in, or leaves at its end. */
const STRAY_QUOTES = /^["'“”„]+|["'“”„]+$/gu;

/** Why the canned greeting goes out instead: the model is off, the call failed, or the reply was unusable. */
export type GreetingFallbackReason = "disabled" | "generation-failed" | "unusable-response";

export type GreetingResult =
  | { kind: "generated"; reply: GreetingReply }
  | { kind: "fallback"; reason: GreetingFallbackReason };

/** Sakke's greeting from the facts, or why the canned one is used instead. Never throws. */
export async function writeGreeting(ollama: OllamaClient, facts: GreetingFacts, llmEnabled: boolean): Promise<GreetingResult> {
  if (!llmEnabled) return { kind: "fallback", reason: "disabled" };

  let raw: string;
  try {
    raw = await ollama.generateStructured(buildMessages(facts), greetingReplyJsonSchema, GREETING_MODEL_OPTIONS);
  } catch (error) {
    log.error({ err: error }, "morning greeting generation failed");
    return { kind: "fallback", reason: "generation-failed" };
  }

  const reply = parseReply(raw);
  if (!reply) {
    log.warn({ raw }, "unusable morning greeting from the model");
    return { kind: "fallback", reason: "unusable-response" };
  }

  return { kind: "generated", reply };
}

function buildMessages(facts: GreetingFacts): OllamaMessage[] {
  return [
    { role: "system", content: greetingSystemPrompt() },
    { role: "user", content: buildGreetingRequest(facts) },
  ];
}

/** The reply with stray quotes removed; null when it isn't the schema's JSON or no text is left. */
function parseReply(raw: string): GreetingReply | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = greetingReplySchema.safeParse(json);
  if (!result.success) return null;

  const text = result.data.text.replace(STRAY_QUOTES, "").trim();
  return text ? { ...result.data, text } : null;
}
