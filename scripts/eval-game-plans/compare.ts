import type { PlanReaderResult } from "../../src/features/games/planReader";
import type { PlanReading } from "../../src/features/games/schema";
import type { EvalCase, ExpectedPlan } from "./cases";

export const FIELDS = ["isPlan", "day", "time", "courses", "players", "creatorPlays"] as const;
export type Field = typeof FIELDS[number];

export interface FieldCheck {
  field: Field;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface CaseCheck {
  passed: boolean;
  fields: FieldCheck[];
}

const NONE = "–";

/**
 * The reader's result against the case, field by field. A case that isn't a plan checks only
 * `isPlan`. Courses must come in order, players in any; both ignore case.
 */
export function checkReading(expected: EvalCase["expected"], result: PlanReaderResult): CaseCheck {
  const isPlanCheck = check("isPlan", expected.isPlan ? "plan" : "not a plan", describeKind(result));
  if (!expected.isPlan) return summarize([isPlanCheck]);

  const reading = result.kind === "plan" ? result.reading : null;

  return summarize([isPlanCheck, ...checkPlanFields(expected, reading)]);
}

function checkPlanFields(expected: ExpectedPlan, reading: PlanReading | null): FieldCheck[] {
  return [
    check("day", show(expected.day), show(reading ? reading.day : undefined)),
    check("time", show(expected.time), show(reading ? reading.time : undefined)),
    check("courses", showList(expected.courses), showList(reading?.courses)),
    check("players", showList(sortedNames(expected.players)), showList(reading ? sortedNames(reading.players) : undefined)),
    check("creatorPlays", show(expected.creatorPlays), show(reading ? reading.creatorPlays : undefined)),
  ];
}

function check(field: Field, expected: string, actual: string): FieldCheck {
  return { field, passed: normalize(expected) === normalize(actual), expected, actual };
}

function summarize(fields: FieldCheck[]): CaseCheck {
  return { passed: fields.every(field => field.passed), fields };
}

function describeKind(result: PlanReaderResult): string {
  switch (result.kind) {
    case "plan": return "plan";
    case "not-a-plan": return "not a plan";
    case "failed": return `failed: ${result.reason}`;
  }
}

/** A value as the report shows it; undefined is a missing reading, null an empty field. */
function show(value: string | boolean | null | undefined): string {
  if (value === undefined) return "(no reading)";

  return value === null ? NONE : String(value);
}

function showList(values: readonly string[] | undefined): string {
  if (values === undefined) return "(no reading)";

  return values.length > 0 ? values.map(value => value.trim()).join(", ") : NONE;
}

function sortedNames(names: readonly string[]): string[] {
  return [...names].sort((a, b) => a.toLocaleLowerCase("fi").localeCompare(b.toLocaleLowerCase("fi"), "fi"));
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("fi");
}
