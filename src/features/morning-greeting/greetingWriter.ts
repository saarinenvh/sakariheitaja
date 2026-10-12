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

/** Sakke's greeting: its parts as the model wrote them, and the message they make. */
export interface WrittenGreeting {
  greeting: string;
  /** Null when there was no weather to joke about. */
  weather: string | null;
  games: string;
  gifQuery: GreetingReply["gifQuery"];
  /** The parts, each its own paragraph with a blank line between. */
  text: string;
}

export type GreetingResult =
  | { kind: "generated"; reply: WrittenGreeting }
  | { kind: "fallback"; reason: GreetingFallbackReason };

/**
 * Sakke's greeting from the facts, or why the canned one is used instead. Never throws.
 * `systemPrompt` replaces the real one; only the eval harness passes it.
 */
export async function writeGreeting(
  ollama: OllamaClient, facts: GreetingFacts, llmEnabled: boolean, systemPrompt?: string,
): Promise<GreetingResult> {
  if (!llmEnabled) return { kind: "fallback", reason: "disabled" };

  let raw: string;
  try {
    raw = await ollama.generateStructured(buildMessages(systemPrompt ?? greetingSystemPrompt(), facts), greetingReplyJsonSchema, GREETING_MODEL_OPTIONS);
  } catch (error) {
    log.error({ err: error }, "morning greeting generation failed");
    return { kind: "fallback", reason: "generation-failed" };
  }

  const reply = parseReply(raw, facts);
  if (!reply) {
    log.warn({ raw }, "unusable morning greeting from the model");
    return { kind: "fallback", reason: "unusable-response" };
  }

  return { kind: "generated", reply };
}

function buildMessages(systemPrompt: string, facts: GreetingFacts): OllamaMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildGreetingRequest(facts) },
  ];
}

/**
 * The greeting from the reply, each part without stray quotes; null when it isn't the schema's JSON
 * or the greeting or games part is left empty. A weather joke without weather facts is dropped.
 */
function parseReply(raw: string, facts: GreetingFacts): WrittenGreeting | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = greetingReplySchema.safeParse(json);
  if (!result.success) return null;

  const greeting = withoutStrayQuotes(result.data.greeting);
  const games = withoutStrayQuotes(result.data.games);
  const weather = facts.weather ? withoutStrayQuotes(result.data.weather) || null : null;
  if (!greeting || !games) return null;

  const text = [greeting, weather, games].filter(Boolean).join("\n\n");
  return { greeting, weather, games, gifQuery: result.data.gifQuery, text };
}

function withoutStrayQuotes(part: string): string {
  return part.replace(STRAY_QUOTES, "").trim();
}
