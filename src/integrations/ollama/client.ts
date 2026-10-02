import { moduleLogger } from "../../shared/logger";
import { finishOllamaTrace, startOllamaTrace } from "./trace";

const log = moduleLogger("ollama");

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
  num_gpu?: number;
  num_ctx?: number;
  repeat_penalty?: number;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface OllamaClient {
  /** A free-text reply, with model artifacts (think blocks, turn tokens, wrapping quotes) stripped. */
  generate(messages: OllamaMessage[], options?: OllamaOptions): Promise<string>;
  /** A reply constrained to `jsonSchema`, as raw JSON text, unparsed. */
  generateStructured(messages: OllamaMessage[], jsonSchema: Record<string, unknown>, options?: OllamaOptions): Promise<string>;
}

export function createOllamaClient(config: OllamaConfig): OllamaClient {
  return {
    generate: (messages, options) => generate(config, messages, options),
    generateStructured: (messages, jsonSchema, options) => generateStructured(config, messages, jsonSchema, options),
  };
}

async function callOllama(
  { baseUrl, model, timeoutMs }: OllamaConfig,
  messages: OllamaMessage[],
  options: OllamaOptions,
  format?: Record<string, unknown>,
): Promise<string> {
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

    const json = JSON.parse(rawResponse) as { message?: { content?: string } };
    return json?.message?.content?.trim() ?? "";
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

async function generate(config: OllamaConfig, messages: OllamaMessage[], options: OllamaOptions = {}): Promise<string> {
  const start = Date.now();
  log.debug({ model: config.model, url: config.baseUrl, input: messages.at(-1)?.content.slice(0, 80) ?? "" }, "LLM request");

  const content = await callOllama(config, messages, options);
  if (!content) throw new Error("Ollama returned empty response");

  const result = stripArtifacts(content);
  log.debug({ durationMs: Date.now() - start, output: result.slice(0, 80) }, "LLM response");
  return result;
}

async function generateStructured(
  config: OllamaConfig,
  messages: OllamaMessage[],
  jsonSchema: Record<string, unknown>,
  options: OllamaOptions = {},
): Promise<string> {
  const content = await callOllama(config, messages, options, jsonSchema);
  if (!content) throw new Error("Ollama returned empty response");
  return content;
}
