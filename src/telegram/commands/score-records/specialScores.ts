import { CommandContext, Context } from "grammy";
import { moduleLogger } from "../../../shared/logger";
import { escapeHtml } from "../../../shared/html";
import { truncateCourseName } from "../../../features/commentary";
import {
  buildSpecialScoreReport, NotableScoreKind, SpecialScorePeriod, SpecialScoreReport, SpecialScoreSubject,
} from "../../../features/score-records";
import { SPECIAL_SCORE_WORDS, specialScoreMessages as MSG } from "./messages";
import { HTML_OPTIONS } from "../../sendOptions";
import { CommandHandler } from "../types";

const log = moduleLogger("special-scores-command");

const ALL_TIME_WORD = "alltime";
const LEADERBOARD_NAME_WIDTH = 16;

/** What the command asks for: `/assat [alltime] [course id, course or player]`. */
export interface SpecialScoreArguments {
  period: SpecialScorePeriod;
  query: string | null;
}

/** The handler of /assat, /eaglet or /albatrossit. */
export function showSpecialScores(kind: NotableScoreKind): CommandHandler {
  return async (ctx: CommandContext<Context>): Promise<unknown> => {
    const { period, query } = parseSpecialScoreArguments(ctx.match, new Date());

    try {
      const report = await buildSpecialScoreReport({ kind, chatId: ctx.chat.id, period, query });
      return await ctx.reply(formatSpecialScoreReport(kind, report), HTML_OPTIONS);
    } catch (err: unknown) {
      log.error({ err, kind }, "special score command failed");
      return ctx.reply(MSG.error);
    }
  };
}

/** `alltime` first widens the period from this year; the rest is the course or player to look for. */
export function parseSpecialScoreArguments(match: string, now: Date): SpecialScoreArguments {
  const words = match.trim().split(/\s+/).filter(word => word.length > 0);
  const allTime = words[0]?.toLowerCase() === ALL_TIME_WORD;
  const rest = (allTime ? words.slice(1) : words).join(" ");

  return {
    period: allTime ? { kind: "alltime" } : { kind: "year", year: now.getFullYear() },
    query: rest.length > 0 ? rest : null,
  };
}

export function formatSpecialScoreReport(kind: NotableScoreKind, report: SpecialScoreReport): string {
  const words = SPECIAL_SCORE_WORDS[kind];
  switch (report.kind) {
    case "ambiguous-course":
      return MSG.ambiguousCourse(report.courses.map(course => `<b>${course.id}</b>: ${escapeHtml(course.name)}`).join("\n"), words.command);
    case "ambiguous-player":
      return MSG.ambiguousPlayer(report.players.map(escapeHtml).join("\n"));
    case "not-found":
      return MSG.notFound(escapeHtml(report.query));
    case "report":
      return formatReport(words, report);
  }
}

function formatReport(
  words: (typeof SPECIAL_SCORE_WORDS)[NotableScoreKind], report: Extract<SpecialScoreReport, { kind: "report" }>,
): string {
  const period = report.period.kind === "year" ? MSG.thisYear(report.period.year) : MSG.allTime;
  const heading = MSG.heading(words.title, period, subjectName(report.subject));
  if (report.leaderboard.length === 0) return `${heading}\n\n${MSG.none(words.none, period)}`;

  const leaderboard = report.leaderboard
    .map(({ player, count }) => `${escapeHtml(player.padEnd(LEADERBOARD_NAME_WIDTH))} ${count}`)
    .join("\n");
  const latest = report.latest
    .map(row => MSG.latestLine(
      escapeHtml(row.player), row.course ? escapeHtml(truncateCourseName(row.course)) : null, row.holeNumber, formatDate(row.date),
    ))
    .join("\n");

  return `${heading}\n\n<code>${leaderboard}</code>\n\n${MSG.latestHeader}\n${latest}`;
}

function subjectName(subject: SpecialScoreSubject): string | null {
  return subject.kind === "chat" ? null : escapeHtml(truncateCourseName(subject.name));
}

/** `2026-09-12` → `12.9.2026`. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day}.${month}.${year}`;
}
