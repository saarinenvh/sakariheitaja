import { readFileSync } from "fs";
import { join } from "path";
import { moduleLogger } from "../logger";
import { readConfig } from "../../config";
import { finishOllamaTrace, startOllamaTrace } from "./ollamaTrace";

const log = moduleLogger("ollama");

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
  num_gpu?: number;
  num_ctx?: number;
  repeat_penalty?: number;
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<string>;

const { baseUrl, model, timeoutMs } = readConfig().ollama;

async function callOllama(
  messages: OllamaMessage[],
  options: OllamaOptions,
  tools?: OllamaTool[],
  format?: Record<string, unknown>,
): Promise<{ content: string; toolCalls?: { function: { name: string; arguments: Record<string, unknown> } }[] }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    think: false,
    options: {
      temperature: options.temperature ?? 0.8,
      num_predict: options.num_predict ?? 120,
      num_ctx: options.num_ctx ?? 2048,
      ...(options.num_gpu !== undefined && { num_gpu: options.num_gpu }),
      ...(options.repeat_penalty !== undefined && { repeat_penalty: options.repeat_penalty }),
    },
  };

  if (tools?.length) body.tools = tools;
  if (format) body.format = format;

  const trace = await startOllamaTrace(body);
  let responseReceived = false;
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const rawResponse = await res.text();
    await finishOllamaTrace(trace, { status: res.status, response: parseTraceResponse(rawResponse) });
    responseReceived = true;
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);

    const json = JSON.parse(rawResponse) as { message?: { content?: string; tool_calls?: any[] } };
    return {
      content: json?.message?.content?.trim() ?? "",
      toolCalls: json?.message?.tool_calls,
    };
  } catch (error) {
    if (!responseReceived) {
      await finishOllamaTrace(trace, { error: error instanceof Error ? error.name : "UnknownError" });
    }
    throw error;
  }
}

function parseTraceResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stripArtifacts(text: string): string {
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // strip reasoning blocks
    .replace(/<start_of_turn>[\s\S]*/g, "")    // truncate if model echoes next turn
    .replace(/<end_of_turn>[\s\S]*/g, "")      // truncate at end-of-turn token
    .replace(/<\/start_of_turn>/g, "")          // remove closing variant
    .replace(/<br\s*\/?>/gi, "\n")              // <br> → newline
    .trim();

  return (stripped || text)
    .replace(/^[\u0022\u0027\u201C\u201D\u201E\u2018\u2019]+/, "")
    .replace(/[\u0022\u0027\u201C\u201D\u2018\u2019]+$/, "")
    .trim() || stripped || text;
}

export async function generate(
  messages: OllamaMessage[],
  options: OllamaOptions = {},
  tools?: OllamaTool[],
  toolHandler?: ToolHandler,
): Promise<string> {
  const start = Date.now();
  const history = [...messages];

  const truncated = history.at(-1)?.content.slice(0, 80) ?? "";
  log.debug({ model, url: baseUrl, input: truncated }, "LLM request");

  const MAX_TOOL_ROUNDS = 3;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const { content, toolCalls } = await callOllama(history, options, tools);

    if (toolCalls?.length && toolHandler) {
      log.debug({ tools: toolCalls.map(tc => tc.function.name) }, "LLM tool calls");
      history.push({ role: "assistant", content: content ?? "" });

      for (const tc of toolCalls) {
        const result = await toolHandler(tc.function.name, tc.function.arguments ?? {});
        history.push({ role: "tool", content: result });
      }
      continue;
    }

    if (!content) throw new Error("Ollama returned empty response");

    const result = stripArtifacts(content);
    const ms = Date.now() - start;
    log.debug({ durationMs: ms, output: result.slice(0, 80) }, "LLM response");
    return result;
  }

  throw new Error("Ollama tool call loop exceeded max rounds");
}

/** Requests a reply constrained to `jsonSchema` and returns the raw JSON text, unparsed. */
export async function generateStructured(
  messages: OllamaMessage[],
  jsonSchema: Record<string, unknown>,
  options: OllamaOptions = {},
): Promise<string> {
  const { content } = await callOllama(messages, options, undefined, jsonSchema);
  if (!content) throw new Error("Ollama returned empty response");
  return content;
}

export function loadPrompt(filename: string): string {
  const filePath = join(__dirname, "../../bot/system-prompts", filename);
  return readFileSync(filePath, "utf-8").trim();
}

export function loadContext(filenames: string[]): string {
  return filenames
    .map(filename => {
      try {
        return readFileSync(join(__dirname, "../../bot/system-prompts", filename), "utf-8").trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}
