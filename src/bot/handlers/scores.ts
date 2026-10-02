import { Composer, Context } from "grammy";
import { moduleLogger } from "../../shared/logger";
import * as scoreService from "../../features/disc-golf/services/ScoreService";
import { ScoreRow } from "../../db/repositories/ScoreRepository";
import { scores as MSG } from "../../config/messages";
import { HTML_OPTIONS } from "../../config/bot";

const log = moduleLogger("scores-command");

export const scores = new Composer();

// /tulokset <course name or id>
// Shows the all-time top 10 scores for a course, sorted by best total diff.
// Accepts either a course name (partial match) or a numeric course ID.
// If the name matches multiple courses, lists them with their IDs so the user
// can re-run the command with the exact ID.
scores.command("tulokset", async ctx => {
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
});

async function _sendScores(rows: ScoreRow[], ctx: Context): Promise<void> {
  if (rows.length === 0) {
    await ctx.reply(MSG.noResults);
    return;
  }
  const top = rows.sort((a, b) => a.diff - b.diff).slice(0, 10);
  const rowStr = top.map((row, i) => `${i + 1}\t\t\t\t${row.player}\t\t\t\t${row.diff}\n`).join("");
  await ctx.reply(`${MSG.resultsHeader}\n\n${MSG.results(top[0].course, rowStr)}`, HTML_OPTIONS);
}
