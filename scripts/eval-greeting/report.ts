import { CHECK_DESCRIPTIONS, CheckFinding, CheckId } from "./checks";

export interface GreetingRecord {
  scenario: string;
  run: number;
  /** The facts the model got, as one readable line. */
  facts: string;
  outcome: string;
  durationMs: number;
  text: string;
  gifQuery: string;
  /** How the text opens, for the variety summary. */
  opening: string;
  findings: CheckFinding[];
  /** The model's unprocessed reply, kept only when the writer rejected it. */
  rejectedReply: string | null;
}

export interface GreetingEvalMeta {
  startedAt: string;
  model: string;
  baseUrl: string;
  promptPath: string;
  promptHash: string;
  runs: number;
  scenarios: string[];
}

const MS_PER_SECOND = 1000;
const SEVERITY_MARK = { fail: "❌", warn: "⚠️" } as const;

export function renderMarkdownReport(meta: GreetingEvalMeta, records: readonly GreetingRecord[]): string {
  return [
    "# Morning greeting eval",
    "",
    `- Started: ${meta.startedAt}`,
    `- Model: \`${meta.model}\` at ${meta.baseUrl}`,
    `- Prompt: \`${meta.promptPath}\` after the persona (sha256 of both: ${meta.promptHash})`,
    `- Scenarios: ${meta.scenarios.join(", ")} · runs: ${meta.runs}`,
    "",
    ...renderSummary(records),
    "",
    ...renderGreetings(records),
  ].join("\n");
}

export function renderConsoleSummary(records: readonly GreetingRecord[]): string {
  return renderSummary(records).join("\n");
}

function renderSummary(records: readonly GreetingRecord[]): string[] {
  const durations = records.map(record => record.durationMs);
  const average = durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length);

  const rows: string[] = [];
  for (const check of Object.keys(CHECK_DESCRIPTIONS) as CheckId[]) {
    const counts = countFindings(records, check);
    if (counts.fail + counts.warn === 0) continue;
    rows.push(`| ${check} | ${counts.fail} | ${counts.warn} | ${CHECK_DESCRIPTIONS[check]} |`);
  }

  return [
    "## Summary",
    "",
    `${records.length} greetings · average ${seconds(average)} · slowest ${seconds(Math.max(0, ...durations))}`,
    "",
    "| Check | ❌ fail | ⚠️ warn | Meaning |",
    "| --- | ---: | ---: | --- |",
    ...(rows.length > 0 ? rows : ["| (none) | 0 | 0 | Every check passed |"]),
    "",
    `Openings: ${describeOpenings(records)}`,
  ];
}

/** "huomenta sankarit ×3, aamua ×2, …", most common first. */
function describeOpenings(records: readonly GreetingRecord[]): string {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.opening) counts.set(record.opening, (counts.get(record.opening) ?? 0) + 1);
  }

  return [...counts]
    .sort(([, first], [, second]) => second - first)
    .map(([opening, count]) => (count > 1 ? `${opening} ×${count}` : opening))
    .join(", ") || "(none)";
}

function renderGreetings(records: readonly GreetingRecord[]): string[] {
  const lines: string[] = [];
  let currentScenario = "";

  for (const record of records) {
    if (record.scenario !== currentScenario) {
      lines.push(`## ${record.scenario}`, "", `Facts: ${record.facts}`, "");
      currentScenario = record.scenario;
    }

    const gif = record.gifQuery ? ` · gif: ${record.gifQuery}` : "";
    const marks = record.findings.map(finding => `${SEVERITY_MARK[finding.severity]} ${finding.check}: ${finding.detail}`);
    const details = marks.length > 0 ? ` · ${marks.join(" · ")}` : "";
    lines.push(`**Run ${record.run}** · ${seconds(record.durationMs)} · ${record.outcome}${gif}${details}`, "");

    if (record.text) lines.push(...record.text.split("\n").map(line => `> ${line}`.trimEnd()), "");

    if (record.rejectedReply !== null) {
      lines.push("<details><summary>Rejected model reply</summary>", "", "```json", record.rejectedReply, "```", "", "</details>", "");
    }
  }
  return lines;
}

function countFindings(records: readonly GreetingRecord[], check: CheckId): Record<"fail" | "warn", number> {
  const counts = { fail: 0, warn: 0 };
  for (const record of records) {
    for (const finding of record.findings) if (finding.check === check) counts[finding.severity]++;
  }
  return counts;
}

function seconds(milliseconds: number): string {
  return `${(milliseconds / MS_PER_SECOND).toFixed(1)} s`;
}
