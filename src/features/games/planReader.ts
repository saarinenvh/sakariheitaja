import { OllamaMessage, OllamaOptions } from "../../integrations/ollama/client";
import { buildPlanReaderMessages } from "./prompts";
import { PlanReading, planReadingJsonSchema, planReadingSchema } from "./schema";

/** The model as the reader uses it: messages and a JSON schema in, the raw reply out. */
export type StructuredModel = (messages: OllamaMessage[], jsonSchema: Record<string, unknown>) => Promise<string>;

/**
 * A reading task: a low temperature for the same answer every time, and room for a short JSON object.
 * `num_ctx` matches the general asker's: Ollama reloads the model when it changes, and a mention
 * that isn't a plan goes on to the asker right after.
 */
export const PLAN_READER_MODEL_OPTIONS: OllamaOptions = { temperature: 0.1, num_predict: 300, num_ctx: 8192 };

export interface PlanReaderInput {
  text: string;
  writerName: string;
  /** `YYYY-MM-DD`. */
  today: string;
  /** Replaces the prompt file's rules; the eval's variants. */
  rules?: string;
}

/** `failed` keeps the model's reply, when there was one, so the eval can show why it was refused. */
export type PlanReaderResult =
  | { kind: "plan"; reading: PlanReading }
  | { kind: "not-a-plan" }
  | { kind: "failed"; reason: string; reply: string | null };

/** Reads a plan from free text with one model call. Never throws. */
export async function readPlanWithModel(input: PlanReaderInput, model: StructuredModel): Promise<PlanReaderResult> {
  const messages = buildPlanReaderMessages(input.text, input.writerName, input.today, input.rules);

  let reply: string;
  try {
    reply = await model(messages, planReadingJsonSchema);
  } catch (error) {
    return { kind: "failed", reason: `the model failed: ${errorMessage(error)}`, reply: null };
  }

  const reading = parseReading(reply);
  if (!reading) return { kind: "failed", reason: "the answer isn't a valid plan reading", reply };

  return reading.isPlan ? { kind: "plan", reading } : { kind: "not-a-plan" };
}

function parseReading(reply: string): PlanReading | null {
  let json: unknown;
  try {
    json = JSON.parse(reply);
  } catch {
    return null;
  }

  const result = planReadingSchema.safeParse(json);

  return result.success ? result.data : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
