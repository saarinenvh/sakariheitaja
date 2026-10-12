import { loadPrompt } from "../../prompts/prompts";
import { GreetingFacts } from "./facts";

let systemPrompt: string | null = null;

/** The persona and the greeting prompt; read once. */
export function greetingSystemPrompt(): string {
  systemPrompt ??= buildGreetingSystemPrompt(loadPrompt("morning_greeting.md"));
  return systemPrompt;
}

/** The persona followed by `greetingPrompt`; the eval harness passes a variant here. */
export function buildGreetingSystemPrompt(greetingPrompt: string): string {
  return `${loadPrompt("persona.md")}\n\n---\n\n${greetingPrompt}`;
}

/** The user message: the facts as JSON, as the prompt describes them. */
export function buildGreetingRequest(facts: GreetingFacts): string {
  return JSON.stringify(facts);
}
