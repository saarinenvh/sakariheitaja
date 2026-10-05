import { CommandContext, Context } from "grammy";
import { moduleLogger } from "../../../shared/logger";
import { escapeHtml } from "../../../shared/html";
import { CourseResult, CourseResultsReport, findCourseResults } from "../../../features/score-records";
import { scoreRecordMessages as MSG } from "./messages";
import { HTML_OPTIONS } from "../../sendOptions";

const log = moduleLogger("scores-command");

const SHOWN_RESULT_COUNT = 10;

/** A course's ten best results; a name matching several courses lists them with their ids. */
export async function showCourseResults(ctx: CommandContext<Context>): Promise<unknown> {
  const query = ctx.match.trim();
  if (!query) return ctx.reply(MSG.usage);

  try {
    const report = await findCourseResults(ctx.chat.id, query);
    return await ctx.reply(formatCourseResults(report), HTML_OPTIONS);
  } catch (err: unknown) {
    log.error({ err }, "/tulokset failed");
    return ctx.reply(MSG.error);
  }
}

export function formatCourseResults(report: CourseResultsReport): string {
  switch (report.kind) {
    case "not-found":
      return MSG.noResults;
    case "ambiguous-course":
      return MSG.ambiguousCourse(report.courses.map(course => `<b>${course.id}</b>: ${escapeHtml(course.name)}\n`).join(""));
    case "results":
      return formatResults(report.course, report.results);
  }
}

function formatResults(course: string, results: readonly CourseResult[]): string {
  if (results.length === 0) return MSG.noResults;

  const rows = results.slice(0, SHOWN_RESULT_COUNT)
    .map((result, index) => `${index + 1}\t\t\t\t${escapeHtml(result.player)}\t\t\t\t${result.relativeToPar}\n`)
    .join("");

  return `${MSG.resultsHeader}\n\n${MSG.results(escapeHtml(course), rows)}`;
}
