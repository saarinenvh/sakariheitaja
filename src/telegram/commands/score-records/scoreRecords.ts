import { CommandContext, Context } from "grammy";
import { moduleLogger } from "../../../shared/logger";
import * as scoreService from "../../../features/score-records";
import { ScoreRow } from "../../../features/score-records";
import { scoreRecordMessages as MSG } from "./messages";
import { HTML_OPTIONS } from "../../sendOptions";

const log = moduleLogger("scores-command");

/** A course's ten best results; a name matching several courses lists them with their ids. */
export async function showCourseResults(ctx: CommandContext<Context>): Promise<unknown> {
  const param = ctx.match.trim();
  if (!param) return ctx.reply(MSG.usage);
  const chatId = ctx.chat.id;

  try {
    if (!isNaN(Number(param))) {
      await _sendScores(await scoreService.getByCourseId(param, chatId), ctx);
    } else {
      const rows = await scoreService.getByCourseName(param, chatId);
      if (rows[0]?.count && rows[0].count > 1) {
        const list = [...new Set(rows.map(s => `<b>${s.courseId}</b>: ${s.course}\n`))].join("");
        await ctx.reply(MSG.ambiguousCourse(list), HTML_OPTIONS);
      } else {
        await _sendScores(rows, ctx);
      }
    }
  } catch (err: any) {
    log.error({ err }, "/tulokset failed");
    await ctx.reply(MSG.error);
  }
}

async function _sendScores(rows: ScoreRow[], ctx: Context): Promise<void> {
  if (rows.length === 0) {
    await ctx.reply(MSG.noResults);
    return;
  }
  const top = rows.sort((a, b) => a.diff - b.diff).slice(0, 10);
  const rowStr = top.map((row, i) => `${i + 1}\t\t\t\t${row.player}\t\t\t\t${row.diff}\n`).join("");
  await ctx.reply(`${MSG.resultsHeader}\n\n${MSG.results(top[0].course, rowStr)}`, HTML_OPTIONS);
}
