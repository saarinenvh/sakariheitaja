import * as scoreRepo from "./db/scoreRepository";
import * as courseRepo from "./db/courseRepository";
import { getGroupPlayers } from "../players";
import { NotableScoreKind, SpecialScoreCount, summarizeSpecialScores } from "./policy";

/** `year`: the scores of that calendar year; `alltime`: every saved one. */
export type SpecialScorePeriod = { kind: "year"; year: number } | { kind: "alltime" };

/** What the report covers: the whole chat, one course or one player. */
export type SpecialScoreSubject = { kind: "chat" } | { kind: "course"; name: string } | { kind: "player"; name: string };

export interface SpecialScoreRequest {
  kind: NotableScoreKind;
  chatId: number;
  period: SpecialScorePeriod;
  /** A course id, part of a course name, or part of a player's name; null for the whole chat. */
  query: string | null;
}

/**
 * - `report`: the scores of the subject, with the count per player and the latest ones.
 * - `ambiguous-course` / `ambiguous-player`: several matched; the caller asks which.
 * - `not-found`: no course id, course or player of the chat matches.
 */
export type SpecialScoreReport =
  | {
    kind: "report"; subject: SpecialScoreSubject; period: SpecialScorePeriod;
    leaderboard: SpecialScoreCount[]; latest: scoreRepo.SpecialScoreRow[];
  }
  | { kind: "ambiguous-course"; courses: { id: number; name: string }[] }
  | { kind: "ambiguous-player"; players: string[] }
  | { kind: "not-found"; query: string };

type ResolvedSubject =
  | { kind: "resolved"; subject: SpecialScoreSubject; courseId: number | null; playerId: number | null }
  | Exclude<SpecialScoreReport, { kind: "report" }>;

/** The chat's special scores of one kind, for the whole chat, a course or a player. */
export async function buildSpecialScoreReport(request: SpecialScoreRequest): Promise<SpecialScoreReport> {
  const resolved = await resolveSubject(request.query, request.chatId);
  if (resolved.kind !== "resolved") return resolved;

  const rows = await scoreRepo.findSpecialScores(request.kind, request.chatId, {
    sinceDate: request.period.kind === "year" ? `${request.period.year}-01-01` : null,
    courseId: resolved.courseId,
    playerId: resolved.playerId,
  });

  return { kind: "report", subject: resolved.subject, period: request.period, ...summarizeSpecialScores(rows) };
}

/** A number is a course id; text is searched from course names first, then from the chat's players. */
async function resolveSubject(query: string | null, chatId: number): Promise<ResolvedSubject> {
  if (query === null) return { kind: "resolved", subject: { kind: "chat" }, courseId: null, playerId: null };

  if (/^\d+$/.test(query)) {
    const course = await courseRepo.findById(Number(query));
    if (!course) return { kind: "not-found", query };
    return { kind: "resolved", subject: { kind: "course", name: course.name }, courseId: course.id, playerId: null };
  }

  const courses = await courseRepo.searchByName(query);
  if (courses.length > 1) return { kind: "ambiguous-course", courses: courses.map(({ id, name }) => ({ id, name })) };
  if (courses.length === 1) {
    return { kind: "resolved", subject: { kind: "course", name: courses[0].name }, courseId: courses[0].id, playerId: null };
  }

  return resolvePlayer(query, await getGroupPlayers(chatId));
}

/** An exact name wins over partial matches, so "Matti" still finds Matti when "Mattila" plays too. */
function resolvePlayer(query: string, players: readonly { id: number; name: string }[]): ResolvedSubject {
  const wanted = query.toLocaleLowerCase("fi");
  const exact = players.find(player => player.name.toLocaleLowerCase("fi") === wanted);
  const matches = exact ? [exact] : players.filter(player => player.name.toLocaleLowerCase("fi").includes(wanted));

  if (matches.length === 0) return { kind: "not-found", query };
  if (matches.length > 1) return { kind: "ambiguous-player", players: matches.map(player => player.name) };

  return { kind: "resolved", subject: { kind: "player", name: matches[0].name }, courseId: null, playerId: matches[0].id };
}
