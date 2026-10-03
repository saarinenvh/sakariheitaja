import { OllamaClient } from "../../integrations/ollama/client";
import { getRandom } from "../../shared/utils";
import { sakariResponses } from "./phrases";
import { buildHeckleContext, hecklerSystemPrompt } from "./prompts";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("heckler");

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

export async function llmHeckle(ollama: OllamaClient, chatId: number, trigger: string): Promise<string> {
  const context = buildHeckleContext(getRecentMessages(chatId), trigger);
  const text = await ollama.generate(
    [
      { role: "system", content: hecklerSystemPrompt() },
      { role: "user",   content: context },
    ],
    { temperature: 1.0, num_predict: 60 },
  );
  return text;
}

function cannedHeckle(): string {
  return sakariResponses[getRandom(sakariResponses.length)];
}

/** With the LLM enabled, half canned and half from the model (canned if it fails); otherwise always canned. */
export async function heckle(ollama: OllamaClient, chatId: number, trigger: string, llmEnabled: boolean): Promise<string> {
  const useLlm = llmEnabled && getRandom(2) === 1;

  if (!useLlm) {
    log.debug("heckler → canned");
    return cannedHeckle();
  }

  try {
    log.debug("heckler → LLM");
    return await llmHeckle(ollama, chatId, trigger);
  } catch (err: any) {
    log.warn({ err }, "heckler LLM failed, using canned");
    return cannedHeckle();
  }
}
