import { loadPrompt } from "../../prompts/prompts";
import { GreetingFacts } from "./facts";

let systemPrompt: string | null = null;

/** The persona and the greeting prompt; read once. */
export function greetingSystemPrompt(): string {
  if (!systemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("morning_greeting.md");
    systemPrompt = `${persona}\n\n---\n\n${base}`;
  }
  return systemPrompt;
}

/** The user message: the facts as JSON, as the prompt describes them. */
export function buildGreetingRequest(facts: GreetingFacts): string {
  return JSON.stringify(facts);
}
