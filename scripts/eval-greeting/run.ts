// Dev tool, not shipped app code: writes the morning greeting for each scenario day through the real
// greeting writer against a real Ollama, then checks and reports every greeting.
// Usage:
//   npm run eval:greeting -- --model=gemma4:26b-a4b-q3 --baseUrl=http://172.31.0.1:11434
//   npm run eval:greeting -- --model=... --runs=3 --scenario=rainy-monday-no-games,friday-no-weather --prompt=/tmp/variant.md
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { OllamaClient } from "../../src/integrations/ollama/client";
import type { GreetingFacts } from "../../src/features/morning-greeting/facts";
import { parseFlags, parsePositiveIntegerFlag } from "../eval-shared/cliFlags";
import { createRunDirectory } from "../eval-shared/runDirectory";
import { opening, runChecks } from "./checks";
import { GreetingEvalMeta, GreetingRecord, renderConsoleSummary, renderMarkdownReport } from "./report";
import { GreetingScenario, selectScenarios } from "./scenarios";

const DEFAULT_RUNS = 2;
const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_PROMPT_PATH = join("src", "prompts", "morning_greeting.md");
const DEFAULT_OUT_DIR = join(".eval-results", "greeting");
const PROMPT_HASH_LENGTH = 8;

interface EvalOptions {
  model: string;
  baseUrl: string;
  runs: number;
  promptPath: string;
  scenarioNames: string[];
  outDir: string;
}

interface Runtime {
  ollama: OllamaClient;
  /** The greeting prompt from `--prompt`, as the model gets it: after the persona. */
  systemPrompt: string;
  /** The model's last raw reply, kept so a rejected one can be shown. */
  lastReply: string | null;
}

async function main(): Promise<void> {
  const options = parseOptions(parseFlags(process.argv.slice(2)));
  const scenarios = selectScenarios(options.scenarioNames);
  const prompt = readFileSync(options.promptPath, "utf-8").trim();
  const runtime = await loadRuntime(options, prompt);

  console.log(`Warming up ${options.model} at ${options.baseUrl}...`);
  const { GREETING_MODEL_OPTIONS } = await import("../../src/features/morning-greeting/greetingWriter");
  await runtime.ollama.generateStructured(
    [{ role: "user", content: "Vastaa JSON-objektilla {\"ok\": true}." }], { type: "object" }, GREETING_MODEL_OPTIONS,
  );

  const records: GreetingRecord[] = [];
  for (const scenario of scenarios) {
    for (let run = 1; run <= options.runs; run++) {
      console.log(`Greeting ${scenario.name}, run ${run}/${options.runs}...`);
      records.push(await greet(scenario, run, runtime));
    }
  }

  const directory = writeResults(options.outDir, buildMeta(options, runtime.systemPrompt, scenarios), records, prompt);
  console.log(`\n${renderConsoleSummary(records)}\n\nResults: ${directory}/ (report.md, results.json, prompt.md)`);
  if (records.some(record => record.findings.some(finding => finding.severity === "fail"))) process.exitCode = 1;
}

function parseOptions(flags: ReadonlyMap<string, string>): EvalOptions {
  const model = flags.get("model") || process.env.BOT_OLLAMA_MODEL;
  if (!model) throw new Error("No model given. Pass --model=<name> or set BOT_OLLAMA_MODEL.");

  return {
    model,
    baseUrl: flags.get("baseUrl") || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
    runs: parsePositiveIntegerFlag(flags, "runs", DEFAULT_RUNS),
    promptPath: flags.get("prompt") || DEFAULT_PROMPT_PATH,
    scenarioNames: (flags.get("scenario") ?? "").split(",").map(name => name.trim()).filter(Boolean),
    outDir: flags.get("out") || DEFAULT_OUT_DIR,
  };
}

async function loadRuntime(options: EvalOptions, prompt: string): Promise<Runtime> {
  const { createOllamaClient } = await import("../../src/integrations/ollama/client");
  const { buildGreetingSystemPrompt } = await import("../../src/features/morning-greeting/prompts");
  const timeoutMs = Number(process.env.BOT_OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const client = createOllamaClient({ baseUrl: options.baseUrl, model: options.model, timeoutMs });

  const runtime: Runtime = { ollama: client, systemPrompt: buildGreetingSystemPrompt(prompt), lastReply: null };
  runtime.ollama = {
    ...client,
    generateStructured: async (messages, jsonSchema, modelOptions) => {
      runtime.lastReply = await client.generateStructured(messages, jsonSchema, modelOptions);
      return runtime.lastReply;
    },
  };
  return runtime;
}

async function greet(scenario: GreetingScenario, run: number, runtime: Runtime): Promise<GreetingRecord> {
  const { writeGreeting } = await import("../../src/features/morning-greeting/greetingWriter");
  runtime.lastReply = null;

  const startedAt = Date.now();
  const result = await writeGreeting(runtime.ollama, scenario.facts, true, runtime.systemPrompt);
  const durationMs = Date.now() - startedAt;

  const generated = result.kind === "generated" ? result.reply : null;
  return {
    scenario: scenario.name,
    run,
    facts: describeFacts(scenario.facts),
    outcome: result.kind === "generated" ? "generated" : `fallback (${result.reason})`,
    durationMs,
    text: generated?.text ?? "",
    gifQuery: generated?.gifQuery ?? "",
    opening: generated ? opening(generated.text) : "",
    findings: runChecks(scenario.facts, result),
    rejectedReply: generated ? null : runtime.lastReply,
  };
}

function describeFacts(facts: GreetingFacts): string {
  const weather = facts.weather
    ? `${facts.weather.town} ${facts.weather.temperatureC} °C, ${facts.weather.windMs} m/s, ${facts.weather.description}`
    : "no weather";
  const games = facts.todaysGames.length > 0
    ? `games: ${facts.todaysGames.map(game => `${game.players} players`).join(", ")}`
    : "no games";
  const history = facts.recentGreetings.length > 0 ? `${facts.recentGreetings.length} recent greetings` : "no history";
  return `${facts.weekday} ${facts.date} · ${weather} · ${games} · ${history}`;
}

/** The hash covers the persona too, so a persona change shows as a different prompt. */
function buildMeta(options: EvalOptions, systemPrompt: string, scenarios: readonly GreetingScenario[]): GreetingEvalMeta {
  return {
    startedAt: new Date().toISOString(),
    model: options.model,
    baseUrl: options.baseUrl,
    promptPath: options.promptPath,
    promptHash: createHash("sha256").update(systemPrompt).digest("hex").slice(0, PROMPT_HASH_LENGTH),
    runs: options.runs,
    scenarios: scenarios.map(scenario => scenario.name),
  };
}

/** Each eval invocation gets the next free `runN/` folder with its report, data and the exact prompt used. */
function writeResults(outDir: string, meta: GreetingEvalMeta, records: readonly GreetingRecord[], prompt: string): string {
  const directory = createRunDirectory(outDir);
  writeFileSync(join(directory, "report.md"), renderMarkdownReport(meta, records));
  writeFileSync(join(directory, "results.json"), `${JSON.stringify({ meta, records }, null, 2)}\n`);
  writeFileSync(join(directory, "prompt.md"), `${prompt}\n`);
  return directory;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
