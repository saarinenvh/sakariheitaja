import { generate, loadPrompt } from "../shared/llm/ollamaClient";
import { getRandom } from "../shared/utils";
import { sakariResponses } from "../config/phrases";
import Logger from "js-logger";

// In-memory ring buffer: last 10 messages per chat
const messageBuffer = new Map<number, string[]>();

export function recordMessage(chatId: number, text: string): void {
  const buf = messageBuffer.get(chatId) ?? [];
  buf.push(text);
  if (buf.length > 10) buf.shift();
  messageBuffer.set(chatId, buf);
}

export function getRecentMessages(chatId: number): string[] {
  return messageBuffer.get(chatId) ?? [];
}

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!systemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("heckler.md");
    systemPrompt = `${persona}\n\n---\n\n${base}`;
  }
  return systemPrompt;
}

function buildContext(chatId: number, trigger: string): string {
  const recent = messageBuffer.get(chatId) ?? [];
  const lines: string[] = [];

  if (recent.length > 0) {
    lines.push("Recent messages:");
    recent.forEach((msg, i) => lines.push(`${i + 1}. "${msg}"`));
    lines.push("");
  }

  lines.push(`Trigger message:\n"${trigger}"`);
  lines.push("");
  lines.push("Write a very short Sakke-style reaction.");
  return lines.join("\n");
}

export async function llmHeckle(chatId: number, trigger: string): Promise<string> {
  const context = buildContext(chatId, trigger);
  const text = await generate(
    [
      { role: "system", content: getSystemPrompt() },
      { role: "user",   content: context },
    ],
    { temperature: 1.0, num_predict: 60 },
  );
  return text;
}

function cannedHeckle(): string {
  return sakariResponses[getRandom(sakariResponses.length)];
}

// 50% canned, 50% LLM — falls back to canned if LLM fails
export async function heckle(chatId: number, trigger: string): Promise<string> {
  const useLlm = getRandom(2) === 1;

  if (!useLlm) {
    Logger.debug(`Heckler → canned`);
    return cannedHeckle();
  }

  try {
    Logger.debug(`Heckler → LLM`);
    return await llmHeckle(chatId, trigger);
  } catch (err: any) {
    Logger.warn(`Heckler LLM failed, using canned: ${err.message}`);
    return cannedHeckle();
  }
}
