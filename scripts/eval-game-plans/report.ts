import { FieldCheck, FIELDS } from "./compare";

export interface EvalMeta {
  startedAt: string;
  model: string;
  baseUrl: string;
  readerPromptPath: string;
  readerPromptHash: string;
  commentPromptPath: string;
  commentPromptHash: string;
  runs: number;
  cases: number;
}

export interface EvalRecord {
  name: string;
  text: string;
  today: string;
  run: number;
  passed: boolean;
  fields: FieldCheck[];
  durationMs: number;
  /** Sakke's comment on the plan the reader read; null when it read no plan, or comments are off. */
  comment: { source: "model" | "canned"; text: string } | null;
  /** The model's raw reply, kept only when the reader refused it. */
  rejectedReply: string | null;
}

const MS_PER_SECOND = 1000;
const COMMENT_MARK = { model: "🤖", canned: "📦" } as const;

export function renderMarkdownReport(meta: EvalMeta, records: readonly EvalRecord[]): string {
  return [
    "# Game plan reader eval",
    "",
    `- Started: ${meta.startedAt}`,
    `- Model: \`${meta.model}\` at ${meta.baseUrl}`,
    `- Reader prompt: \`${meta.readerPromptPath}\` (sha256 ${meta.readerPromptHash})`,
    `- Comment prompt: \`${meta.commentPromptPath}\` (sha256 ${meta.commentPromptHash})`,
    `- Cases: ${meta.cases} · runs: ${meta.runs}`,
    "",
    ...renderSummary(records),
    "",
    "## Cases",
    "",
    "| Case | Run | | Wrong fields (expected → read) | Time | Sakke |",
    "| --- | --- | --- | --- | --- | --- |",
    ...records.map(renderCaseRow),
    ...renderRejectedReplies(records),
  ].join("\n");
}

export function renderConsoleSummary(records: readonly EvalRecord[]): string {
  return renderSummary(records).join("\n");
}

function renderSummary(records: readonly EvalRecord[]): string[] {
  const passed = records.filter(record => record.passed).length;

  return [
    "## Summary",
    "",
    `Cases passed: ${passed}/${records.length} (${percent(passed, records.length)})`,
    "",
    "| Field | Right | Accuracy |",
    "| --- | --- | --- |",
    ...FIELDS.map(field => renderFieldRow(field, records)),
  ];
}

function renderFieldRow(field: typeof FIELDS[number], records: readonly EvalRecord[]): string {
  const checks = records.flatMap(record => record.fields.filter(check => check.field === field));
  const right = checks.filter(check => check.passed).length;

  return `| ${field} | ${right}/${checks.length} | ${percent(right, checks.length)} |`;
}

function renderCaseRow(record: EvalRecord): string {
  const wrong = record.fields.filter(check => !check.passed)
    .map(check => `${check.field}: ${check.expected} → ${check.actual}`).join("<br>");
  const comment = record.comment ? `${COMMENT_MARK[record.comment.source]} ${record.comment.text}` : "";
  const seconds = (record.durationMs / MS_PER_SECOND).toFixed(1);

  return `| ${cell(record.name)}<br><sub>${cell(record.text)}</sub> | ${record.run} | ${record.passed ? "✅" : "❌"} | ${cell(wrong)} | ${seconds} s | ${cell(comment)} |`;
}

function renderRejectedReplies(records: readonly EvalRecord[]): string[] {
  const rejected = records.filter(record => record.rejectedReply !== null);
  if (rejected.length === 0) return [];

  return [
    "",
    "## Rejected replies",
    "",
    ...rejected.flatMap(record => [`### ${record.name} (run ${record.run})`, "", "```", record.rejectedReply ?? "", "```", ""]),
  ];
}

/** Keeps a table cell on one row. */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "–" : `${Math.round((part / whole) * 100)} %`;
}
