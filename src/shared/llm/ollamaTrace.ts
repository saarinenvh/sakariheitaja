import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Logger from "js-logger";
import { readConfig } from "../../config";

interface OllamaTrace {
  id: string;
  startedAt: string;
  request: unknown;
}

const TRACE_DIRECTORY = "logs/ollama";

export async function startOllamaTrace(request: unknown): Promise<OllamaTrace | undefined> {
  if (!readConfig().ollama.trace) return undefined;
  const trace = { id: randomUUID(), startedAt: new Date().toISOString(), request };
  await saveTrace(trace, { state: "pending" });
  return trace;
}

export async function finishOllamaTrace(
  trace: OllamaTrace | undefined,
  outcome: { status: number; response: unknown } | { error: string },
): Promise<void> {
  if (!trace) return;
  await saveTrace(trace, { state: "finished", finishedAt: new Date().toISOString(), ...outcome });
}

async function saveTrace(trace: OllamaTrace, outcome: object): Promise<void> {
  try {
    await mkdir(TRACE_DIRECTORY, { recursive: true, mode: 0o700 });
    const filename = `${trace.startedAt.replace(/[:.]/g, "-")}-${trace.id}.json`;
    await writeFile(join(TRACE_DIRECTORY, filename), JSON.stringify({ ...trace, ...outcome }, null, 2), { mode: 0o600 });
  } catch {
    Logger.warn("Could not write Ollama trace to logs/ollama; inference continues without this diagnostic.");
  }
}
