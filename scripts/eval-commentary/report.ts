import { CHECK_DESCRIPTIONS, CheckFinding, CheckId } from "./checks";

export interface EvalRecord {
  fixture: string;
  run: number;
  holes: string;
  facts: string;
  /** Course and hole facts the model received, as one line; empty when Metrix had none. */
  courseFacts: string;
  outcome: string;
  durationMs: number;
  message: string;
  findings: CheckFinding[];
  /** The model's unprocessed reply, kept only when the writer rejected it. */
  rejectedReply: string | null;
}

export interface EvalMeta {
  startedAt: string;
  model: string;
  baseUrl: string;
  promptPath: string;
  promptHash: string;
  runs: number;
  holeRange: string;
  playerOrder: "input" | "reversed";
  fixtures: string[];
}

const MS_PER_SECOND = 1000;
const SEVERITY_MARK = { fail: "❌", warn: "⚠️", info: "ℹ️" } as const;

export function renderMarkdownReport(meta: EvalMeta, records: readonly EvalRecord[]): string {
  return [
    "# Commentary eval",
    "",
    `- Started: ${meta.startedAt}`,
    `- Model: \`${meta.model}\` at ${meta.baseUrl}`,
    `- Prompt: \`${meta.promptPath}\` (sha256 ${meta.promptHash})`,
    `- Fixtures: ${meta.fixtures.join(", ")} · runs: ${meta.runs} · holes: ${meta.holeRange} · player order: ${meta.playerOrder}`,
    "",
    ...renderSummary(records),
    "",
    ...renderMessages(records),
  ].join("\n");
}

export function renderConsoleSummary(records: readonly EvalRecord[]): string {
  return renderSummary(records).join("\n");
}

function renderSummary(records: readonly EvalRecord[]): string[] {
  const durations = records.map(record => record.durationMs);
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  const rows: string[] = [];
  for (const check of Object.keys(CHECK_DESCRIPTIONS) as CheckId[]) {
    const counts = countFindings(records, check);
    if (counts.fail + counts.warn + counts.info === 0) continue;
    rows.push(`| ${check} | ${counts.fail} | ${counts.warn} | ${counts.info} | ${CHECK_DESCRIPTIONS[check]} |`);
  }
  return [
    "## Summary",
    "",
    `${records.length} messages · average ${seconds(average)} · slowest ${seconds(Math.max(0, ...durations))}`,
    "",
    "| Check | ❌ fail | ⚠️ warn | ℹ️ info | Meaning |",
    "| --- | ---: | ---: | ---: | --- |",
    ...(rows.length > 0 ? rows : ["| (none) | 0 | 0 | 0 | Every check passed |"]),
  ];
}

function renderMessages(records: readonly EvalRecord[]): string[] {
  const lines: string[] = [];
  let currentFixture = "";
  let currentHoles = "";
  const ordered = [...records].sort((first, second) =>
    first.fixture.localeCompare(second.fixture) || holeOrder(first.holes) - holeOrder(second.holes) || first.run - second.run);
  for (const record of ordered) {
    if (record.fixture !== currentFixture) {
      lines.push(`## ${record.fixture}`, "");
      currentFixture = record.fixture;
      currentHoles = "";
    }
    if (record.holes !== currentHoles) {
      lines.push(`### Väylä ${record.holes}`, "", `Facts: ${record.facts}`, "");
      if (record.courseFacts) lines.push(`Course: ${record.courseFacts}`, "");
      currentHoles = record.holes;
    }
    const marks = record.findings.map(finding => `${SEVERITY_MARK[finding.severity]} ${finding.check}: ${finding.detail}`);
    lines.push(`**Run ${record.run}** · ${seconds(record.durationMs)} · ${record.outcome}${marks.length ? ` · ${marks.join(" · ")}` : ""}`, "");
    lines.push(...record.message.split("\n").map(line => `> ${line}`), "");
    if (record.rejectedReply !== null) {
      lines.push("<details><summary>Rejected model reply</summary>", "", "```json", record.rejectedReply, "```", "", "</details>", "");
    }
  }
  return lines;
}

function countFindings(records: readonly EvalRecord[], check: CheckId): Record<"fail" | "warn" | "info", number> {
  const counts = { fail: 0, warn: 0, info: 0 };
  for (const record of records) {
    for (const finding of record.findings) if (finding.check === check) counts[finding.severity]++;
  }
  return counts;
}

function holeOrder(holes: string): number {
  const first = Number.parseInt(holes, 10);
  return Number.isNaN(first) ? Number.MAX_SAFE_INTEGER : first;
}

function seconds(milliseconds: number): string {
  return `${(milliseconds / MS_PER_SECOND).toFixed(1)} s`;
}
