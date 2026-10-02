// Dev tool, not shipped app code: replays commentary fixtures hole by hole through the real
// RoundCommentary and batch writer against a real Ollama, then checks and reports every message.
// Usage:
//   npm run eval:commentary -- --model=gemma4:26b-a4b-q3 --baseUrl=http://172.31.0.1:11434
//   npm run eval:commentary -- --model=... --runs=3 --holes=1-6 --fixture=harkalinna-top4 --prompt=/tmp/variant.md
//   --reverse-players sends the update's players to the model in reverse order (to test position effects)
import { createHash } from "crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { OllamaMessage, OllamaOptions } from "../../src/integrations/ollama/client";
import type { BatchCommentaryContext } from "../../src/features/commentary/facts/commentaryContext";
import type { BatchCommentaryResult } from "../../src/features/commentary/write/commentaryWriter";
import type { WeatherObservation } from "../../src/integrations/openweather/client";
import type { CourseInfo } from "../../src/features/commentary/facts/courseCommentaryFacts";
import { HoleRange, parseFlags, parseHoleRange, parsePositiveIntegerFlag } from "./cliFlags";
import { CommentaryFixture, FixtureWeather, loadFixtures } from "./fixtureFile";
import { EvalMeta, EvalRecord, renderConsoleSummary, renderMarkdownReport } from "./report";
import { buildReplaySteps, REPLAY_ROUND_ID } from "./replay";
import { runChecks } from "./checks";
import { selectCommentaryRating } from "../../src/features/commentary/facts/roundRatings";

const DEFAULT_RUNS = 1;
const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_PROMPT_PATH = join("src", "prompts", "batch_commentator.md");
const DEFAULT_OUT_DIR = ".eval-results";
const EVAL_CHAT_ID = -1;
const PROMPT_HASH_LENGTH = 8;
const RUN_DIR_PREFIX = "run";

interface EvalOptions {
  model: string;
  baseUrl: string;
  runs: number;
  promptPath: string;
  fixtureNames: string[];
  holeRange: HoleRange | null;
  outDir: string;
  reversePlayers: boolean;
}

type StructuredGenerate = (messages: OllamaMessage[], jsonSchema: Record<string, unknown>, options: OllamaOptions) => Promise<string>;

interface Runtime {
  generate: StructuredGenerate;
  modelOptions: OllamaOptions;
  prompt: string;
  holeRange: HoleRange | null;
  reversePlayers: boolean;
}

async function main(): Promise<void> {
  const options = parseOptions(parseFlags(process.argv.slice(2)));
  configureOllamaEnvironment(options);
  const runtime = await loadRuntime(options);
  const fixtures = loadFixtures(options.fixtureNames);
  const meta = buildMeta(options, runtime.prompt, fixtures);

  console.log(`Warming up ${options.model} at ${options.baseUrl}...`);
  await runtime.generate([{ role: "user", content: "Vastaa JSON-objektilla {\"ok\": true}." }], { type: "object" }, runtime.modelOptions);

  const records: EvalRecord[] = [];
  for (const fixture of fixtures) {
    for (let run = 1; run <= options.runs; run++) {
      console.log(`Replaying ${fixture.name}, run ${run}/${options.runs}...`);
      records.push(...await replayFixture(fixture, run, runtime));
    }
  }

  if (records.length === 0) {
    throw new Error("No fixture updates matched the selection; check --holes and --fixture.");
  }
  const paths = writeResults(options.outDir, meta, records, runtime.prompt);
  console.log(`\n${renderConsoleSummary(records)}\n\nResults: ${paths.directory}/ (report.md, results.json, prompt.md)`);
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
    fixtureNames: (flags.get("fixture") ?? "").split(",").map(name => name.trim()).filter(Boolean),
    holeRange: parseHoleRange(flags.get("holes")),
    outDir: flags.get("out") || DEFAULT_OUT_DIR,
    reversePlayers: flags.has("reverse-players"),
  };
}

// The Ollama client reads its model, URL and timeout when first imported, so they are set before it loads.
function configureOllamaEnvironment(options: EvalOptions): void {
  process.env.BOT_OLLAMA_MODEL = options.model;
  process.env.OLLAMA_BASE_URL = options.baseUrl;
  process.env.BOT_OLLAMA_TIMEOUT_MS ??= String(DEFAULT_TIMEOUT_MS);
}

async function loadRuntime(options: EvalOptions): Promise<Runtime> {
  const { ollama } = await import("../../src/integrations/ollama");
  const { COMMENTARY_MODEL_OPTIONS } = await import("../../src/features/commentary/write/commentaryRuntime");
  return {
    generate: ollama.generateStructured,
    modelOptions: COMMENTARY_MODEL_OPTIONS,
    prompt: readFileSync(options.promptPath, "utf-8").trim(),
    holeRange: options.holeRange,
    reversePlayers: options.reversePlayers,
  };
}

async function replayFixture(fixture: CommentaryFixture, run: number, runtime: Runtime): Promise<EvalRecord[]> {
  const { RoundCommentary } = await import("../../src/features/commentary/roundCommentary");
  const { parseMetrixRound } = await import("../../src/integrations/metrix/round/normalize");
  const { trackRoundPlayers } = await import("../../src/integrations/metrix/round/results");
  const tracked = fixture.tracked.map((name, index) => ({ id: index + 1, name }));
  const weather = [fixture.weather.start, fixture.weather.halfway];
  let weatherRequests = 0;
  const records: EvalRecord[] = [];
  let current: EvalRecord | null = null;

  const session = new RoundCommentary(EVAL_CHAT_ID, REPLAY_ROUND_ID, {
    write: async context => {
      const evaluated = await writeEvaluated(context, runtime);
      // Holes outside --holes still publish a fallback; it must not be appended to the previous record.
      current = evaluated.record ? { ...evaluated.record, fixture: fixture.name, run } : null;
      if (current) records.push(current);
      return evaluated.result;
    },
    fetchWeather: async () => toObservation(weather[Math.min(weatherRequests++, weather.length - 1)], fixture.date),
    fetchCourse: async () => loadFixtureCourse(fixture),
    send: async html => {
      if (current) current.message = [current.message, toPlainText(html)].filter(Boolean).join("\n\n");
    },
    saveScores: async () => undefined,
    onError: error => console.error(`  delivery error: ${error instanceof Error ? error.message : String(error)}`),
  });

  for (const step of buildReplaySteps(fixture)) {
    const round = parseMetrixRound(step.payload, REPLAY_ROUND_ID);
    session.observe(round, trackRoundPlayers(round, tracked));
    await session.idle();
  }
  return records;
}

type EvaluatedWrite = { result: BatchCommentaryResult; record: Omit<EvalRecord, "fixture" | "run"> | null };

async function writeEvaluated(context: BatchCommentaryContext, runtime: Runtime): Promise<EvaluatedWrite> {
  const { buildBatchFallback, writeBatchCommentary } = await import("../../src/features/commentary/write/commentaryWriter");
  const holes = updatedHoles(context);
  if (!isInRange(holes, runtime.holeRange)) {
    return { result: { kind: "fallback", commentary: buildBatchFallback(context), reason: "disabled" }, record: null };
  }
  let rawReply: string | null = null;
  const startedAt = Date.now();
  const modelContext = runtime.reversePlayers ? { ...context, players: [...context.players].reverse() } : context;
  const modelResult = await writeBatchCommentary(modelContext, runtime.prompt, async (messages, jsonSchema) => {
    rawReply = await runtime.generate(messages, jsonSchema, runtime.modelOptions);
    return rawReply;
  });
  const result = restorePlayerOrder(modelResult, context);
  return {
    result,
    record: {
      holes: holes.join(", "),
      facts: describeFacts(context),
      courseFacts: [context.holeFacts, context.courseDifficulty, describeRatings(context)].filter(Boolean).join(" · "),
      outcome: result.kind === "generated" ? "generated" : `fallback (${result.reason})`,
      durationMs: Date.now() - startedAt,
      message: "",
      findings: runChecks({ context, result, rawReply }),
      rejectedReply: result.kind === "fallback" ? rawReply : null,
    },
  };
}

/** RoundCommentary pairs lines with players by position, so lines go back to the original order. */
function restorePlayerOrder(result: BatchCommentaryResult, context: BatchCommentaryContext): BatchCommentaryResult {
  const order = new Map(context.players.map((brief, index) => [brief, index]));
  const lines = [...result.commentary.lines].sort((first, second) => (order.get(first.brief) ?? 0) - (order.get(second.brief) ?? 0));
  return { ...result, commentary: { ...result.commentary, lines } };
}

function updatedHoles(context: BatchCommentaryContext): string[] {
  return [...new Set(context.players.flatMap(brief => brief.changes.map(change => change.holeLabel ?? String(change.holeNumber))))];
}

function isInRange(holes: readonly string[], range: HoleRange | null): boolean {
  if (!range) return true;
  return holes.some(hole => {
    const number = Number.parseInt(hole, 10);
    return number >= range.first && number <= range.last;
  });
}

/** Ratings of this update's finished players, marked with the tier the model got, if any. */
function describeRatings(context: BatchCommentaryContext): string | null {
  const ratings = context.players.flatMap(brief => {
    const rating = context.roundRatings.get(brief.playerName);
    if (rating === undefined) return [];
    const name = context.spokenNames.get(brief.playerName) ?? brief.playerName;
    return [`${name} rating ${rating} (${selectCommentaryRating(rating)?.tier ?? "not given to the model"})`];
  });
  return ratings.length > 0 ? ratings.join(", ") : null;
}

function describeFacts(context: BatchCommentaryContext): string {
  return context.players.map(brief => {
    const name = context.spokenNames.get(brief.playerName) ?? brief.playerName;
    const results = brief.changes.map(change => change.kind === "recorded"
      ? `${change.score.relativeToPar === null ? "?" : signed(change.score.relativeToPar)}${(change.score.obCount ?? 0) > 0 ? " OB" : ""}`
      : change.kind).join("/");
    const total = brief.round.recordedRelativeToPar;
    const movement = brief.movementSincePublication.kind;
    return `${name} ${results} (yht. ${total === null ? "?" : signed(total)}, sija ${brief.standing.position ?? "?"}, ${movement})`;
  }).join(" · ");
}

async function loadFixtureCourse(fixture: CommentaryFixture): Promise<CourseInfo> {
  const { parseCourseDetails } = await import("../../src/integrations/metrix/course/courseDetails");
  const { parseStoredCourseStatistics } = await import("../../src/integrations/metrix/statistics/courseStatistics");
  const course = fixture.course;
  return {
    details: course?.detailsResponse ? parseCourseDetails(course.detailsResponse, course.courseId) : null,
    statistics: course?.statistics ? parseStoredCourseStatistics(course.statistics) : null,
  };
}

function toObservation(weather: FixtureWeather, date: string): WeatherObservation {
  return { ...weather, observedAt: new Date(`${date}T12:00:00Z`) };
}

function toPlainText(html: string): string {
  return html
    .replace(/<blockquote>/g, "┃ ").replace(/<\/blockquote>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
}

function buildMeta(options: EvalOptions, prompt: string, fixtures: readonly CommentaryFixture[]): EvalMeta {
  return {
    startedAt: new Date().toISOString(),
    model: options.model,
    baseUrl: options.baseUrl,
    promptPath: options.promptPath,
    promptHash: createHash("sha256").update(prompt).digest("hex").slice(0, PROMPT_HASH_LENGTH),
    runs: options.runs,
    holeRange: options.holeRange ? `${options.holeRange.first}-${options.holeRange.last}` : "all",
    playerOrder: options.reversePlayers ? "reversed" : "input",
    fixtures: fixtures.map(fixture => fixture.name),
  };
}

interface ResultPaths {
  directory: string;
  markdown: string;
  json: string;
}

/** Each eval invocation gets the next free `runN/` folder with its report, data and the exact prompt used. */
function writeResults(outDir: string, meta: EvalMeta, records: readonly EvalRecord[], prompt: string): ResultPaths {
  mkdirSync(outDir, { recursive: true });
  const directory = join(outDir, `${RUN_DIR_PREFIX}${nextRunNumber(outDir)}`);
  mkdirSync(directory);
  const paths = { directory, markdown: join(directory, "report.md"), json: join(directory, "results.json") };
  writeFileSync(paths.markdown, renderMarkdownReport(meta, records));
  writeFileSync(paths.json, `${JSON.stringify({ meta, records }, null, 2)}\n`);
  writeFileSync(join(directory, "prompt.md"), `${prompt}\n`);
  return paths;
}

function nextRunNumber(outDir: string): number {
  const numbers = readdirSync(outDir)
    .map(entry => new RegExp(`^${RUN_DIR_PREFIX}(\\d+)$`).exec(entry))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => Number(match[1]));
  return Math.max(0, ...numbers) + 1;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
