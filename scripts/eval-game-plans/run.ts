// Dev tool, not shipped app code: runs the game plan reader's cases through the real reader and
// comment writer against a real Ollama, checks each reading, and reports.
// Usage:
//   npm run eval:game-plans -- --model=gemma3:12b --baseUrl=http://172.31.0.1:11434
//   npm run eval:game-plans -- --model=... --runs=3 --prompt=/tmp/reader.md --comment-prompt=/tmp/comment.md
//   --case=<text> runs only the cases whose name or message contains it; --no-comments skips Sakke's comments
import { createHash } from "crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { PlanReading } from "../../src/features/games/schema";
import type { PlanLine } from "../../src/features/games/planSummary";
import type { StructuredModel } from "../../src/features/games/planReader";
import type { TextModel } from "../../src/features/games/planComment";
import { parseFlags, parsePositiveIntegerFlag } from "../eval-commentary/cliFlags";
import { DEFAULT_TODAY, DEFAULT_WRITER, EvalCase, evalCases } from "./cases";
import { checkReading } from "./compare";
import { EvalMeta, EvalRecord, renderConsoleSummary, renderMarkdownReport } from "./report";

const DEFAULT_RUNS = 1;
const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUT_DIR = join(".eval-results", "game-plans");
const READER_PROMPT_PATH = join("src", "prompts", "game_plan_reader.md");
const COMMENT_PROMPT_PATHS = [join("src", "prompts", "persona.md"), join("src", "prompts", "game_plan_comment.md")];
const PROMPT_HASH_LENGTH = 8;
const RUN_DIR_PREFIX = "run";

interface EvalOptions {
  model: string;
  baseUrl: string;
  runs: number;
  readerPromptPath: string;
  /** A file replacing the persona and the comment rules together; null uses the bot's two files. */
  commentPromptPath: string | null;
  caseFilter: string | null;
  comments: boolean;
  outDir: string;
}

interface Runtime {
  reader: StructuredModel;
  commenter: TextModel;
  readerRules: string;
  commentRules: string;
}

async function main(): Promise<void> {
  const options = parseOptions(parseFlags(process.argv.slice(2)));
  const runtime = await loadRuntime(options);
  const cases = selectCases(options.caseFilter);
  const meta = buildMeta(options, runtime, cases.length);

  console.log(`Warming up ${options.model} at ${options.baseUrl}...`);
  await runtime.reader([{ role: "user", content: "Vastaa JSON-objektilla {\"ok\": true}." }], { type: "object" });

  const records: EvalRecord[] = [];
  for (let run = 1; run <= options.runs; run++) {
    console.log(`Run ${run}/${options.runs}: ${cases.length} cases...`);
    for (const evalCase of cases) records.push(await runCase(evalCase, run, runtime, options.comments));
  }

  const directory = writeResults(options.outDir, meta, records, runtime);
  console.log(`\n${renderConsoleSummary(records)}\n\nResults: ${directory}/ (report.md, results.json, prompts)`);
  if (records.some(record => !record.passed)) process.exitCode = 1;
}

function parseOptions(flags: ReadonlyMap<string, string>): EvalOptions {
  const model = flags.get("model") || process.env.BOT_OLLAMA_MODEL;
  if (!model) throw new Error("No model given. Pass --model=<name> or set BOT_OLLAMA_MODEL.");

  return {
    model,
    baseUrl: flags.get("baseUrl") || DEFAULT_BASE_URL,
    runs: parsePositiveIntegerFlag(flags, "runs", DEFAULT_RUNS),
    readerPromptPath: flags.get("prompt") || READER_PROMPT_PATH,
    commentPromptPath: flags.get("comment-prompt") || null,
    caseFilter: flags.get("case") || null,
    comments: !flags.has("no-comments"),
    outDir: flags.get("out") || DEFAULT_OUT_DIR,
  };
}

/** The bot's own reader and comment options, against the given model. */
async function loadRuntime(options: EvalOptions): Promise<Runtime> {
  const { createOllamaClient } = await import("../../src/integrations/ollama/client");
  const { PLAN_READER_MODEL_OPTIONS } = await import("../../src/features/games/planReader");
  const { PLAN_COMMENT_MODEL_OPTIONS } = await import("../../src/features/games/planComment");
  const timeoutMs = Number(process.env.BOT_OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const ollama = createOllamaClient({ baseUrl: options.baseUrl, model: options.model, timeoutMs });

  return {
    reader: (messages, jsonSchema) => ollama.generateStructured(messages, jsonSchema, PLAN_READER_MODEL_OPTIONS),
    commenter: messages => ollama.generate(messages, PLAN_COMMENT_MODEL_OPTIONS),
    readerRules: readPrompt(options.readerPromptPath),
    commentRules: options.commentPromptPath
      ? readPrompt(options.commentPromptPath)
      : COMMENT_PROMPT_PATHS.map(readPrompt).join("\n\n---\n\n"),
  };
}

async function runCase(evalCase: EvalCase, run: number, runtime: Runtime, comments: boolean): Promise<EvalRecord> {
  const { readPlanWithModel } = await import("../../src/features/games/planReader");
  const { writePlanComment } = await import("../../src/features/games/planComment");
  const today = evalCase.today ?? DEFAULT_TODAY;

  const startedAt = Date.now();
  const result = await readPlanWithModel(
    { text: evalCase.text, writerName: DEFAULT_WRITER, today, rules: runtime.readerRules }, runtime.reader,
  );
  const durationMs = Date.now() - startedAt;

  const check = checkReading(evalCase.expected, result);
  const comment = comments && result.kind === "plan"
    ? await writePlanComment(toPlanLine(result.reading), DEFAULT_WRITER, runtime.commenter, runtime.commentRules)
    : null;

  console.log(`  ${check.passed ? "✅" : "❌"} ${evalCase.name}`);

  return {
    name: evalCase.name, text: evalCase.text, today, run, passed: check.passed, fields: check.fields, durationMs, comment,
    rejectedReply: result.kind === "failed" ? result.reply : null,
  };
}

/** The plan as the bot would save it: the writer first when they play. */
function toPlanLine(reading: PlanReading): PlanLine {
  const names = reading.creatorPlays ? [DEFAULT_WRITER, ...reading.players] : reading.players;

  return {
    day: reading.day ?? DEFAULT_TODAY,
    startTime: reading.time,
    courses: reading.courses,
    players: names.map(name => ({ name })),
  };
}

function selectCases(filter: string | null): EvalCase[] {
  if (!filter) return evalCases;

  const wanted = filter.toLocaleLowerCase("fi");
  const selected = evalCases.filter(evalCase => `${evalCase.name} ${evalCase.text}`.toLocaleLowerCase("fi").includes(wanted));
  if (selected.length === 0) throw new Error(`No case matches --case=${filter}`);

  return selected;
}

function buildMeta(options: EvalOptions, runtime: Runtime, cases: number): EvalMeta {
  return {
    startedAt: new Date().toISOString(),
    model: options.model,
    baseUrl: options.baseUrl,
    readerPromptPath: options.readerPromptPath,
    readerPromptHash: hash(runtime.readerRules),
    commentPromptPath: options.commentPromptPath ?? COMMENT_PROMPT_PATHS.join(" + "),
    commentPromptHash: hash(runtime.commentRules),
    runs: options.runs,
    cases,
  };
}

function writeResults(outDir: string, meta: EvalMeta, records: readonly EvalRecord[], runtime: Runtime): string {
  mkdirSync(outDir, { recursive: true });
  const directory = join(outDir, `${RUN_DIR_PREFIX}${nextRunNumber(outDir)}`);
  mkdirSync(directory);

  writeFileSync(join(directory, "report.md"), renderMarkdownReport(meta, records));
  writeFileSync(join(directory, "results.json"), `${JSON.stringify({ meta, records }, null, 2)}\n`);
  writeFileSync(join(directory, "reader-prompt.md"), `${runtime.readerRules}\n`);
  writeFileSync(join(directory, "comment-prompt.md"), `${runtime.commentRules}\n`);

  return directory;
}

function nextRunNumber(outDir: string): number {
  const numbers = readdirSync(outDir)
    .map(entry => new RegExp(`^${RUN_DIR_PREFIX}(\\d+)$`).exec(entry))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => Number(match[1]));

  return Math.max(0, ...numbers) + 1;
}

function readPrompt(path: string): string {
  return readFileSync(path, "utf-8").trim();
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, PROMPT_HASH_LENGTH);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
