import { loadPrompt } from "../../prompts/prompts";

let systemPrompt: string | null = null;

/** The persona and the heckler prompt; read once. */
export function hecklerSystemPrompt(): string {
  if (!systemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("heckler.md");
    systemPrompt = `${persona}\n\n---\n\n${base}`;
  }
  return systemPrompt;
}

/** The user message: the chat's recent messages, the one that triggered the heckle, and the ask. */
export function buildHeckleContext(recentMessages: readonly string[], trigger: string): string {
  const lines: string[] = [];

  if (recentMessages.length > 0) {
    lines.push("Recent messages:");
    recentMessages.forEach((msg, i) => lines.push(`${i + 1}. "${msg}"`));
    lines.push("");
  }

  lines.push(`Trigger message:\n"${trigger}"`);
  lines.push("");
  lines.push("Write a very short Sakke-style reaction.");
  return lines.join("\n");
}
