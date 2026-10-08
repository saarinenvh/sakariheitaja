import { OllamaMessage } from "../../integrations/ollama/client";
import { loadPrompt } from "../../prompts/prompts";
import { addDays, weekdayOf } from "../../shared/time";

const READER_PROMPT_FILE = "game_plan_reader.md";
const PERSONA_PROMPT_FILE = "persona.md";
const COMMENT_PROMPT_FILE = "game_plan_comment.md";

/** By `Date.getDay` index. */
const WEEKDAY_NAMES = ["sunnuntai", "maanantai", "tiistai", "keskiviikko", "torstai", "perjantai", "lauantai"];
/** The short forms people write ("la Tali"); in the calendar so the model needn't map them itself. */
const WEEKDAY_SHORT = ["su", "ma", "ti", "ke", "to", "pe", "la"];
const MONDAY = 1;
const CALENDAR_DAYS = 14;
/** By days from today. */
const RELATIVE_DAY_LABELS = ["tänään", "huomenna", "ylihuomenna"];
/** By weeks from this one; 14 days span at most three. */
const WEEK_LABELS = ["tällä viikolla", "ensi viikolla", "sitä seuraavalla viikolla"];

let readerPrompt: string | undefined;
let commentPrompt: string | undefined;

/** The reader's rules, `src/prompts/game_plan_reader.md`, read once. */
export function loadReaderPrompt(): string {
  readerPrompt ??= loadPrompt(READER_PROMPT_FILE);

  return readerPrompt;
}

/** Sakke's persona and the comment's rules, `game_plan_comment.md`, read once. */
export function loadCommentPrompt(): string {
  commentPrompt ??= `${loadPrompt(PERSONA_PROMPT_FILE)}\n\n---\n\n${loadPrompt(COMMENT_PROMPT_FILE)}`;

  return commentPrompt;
}

/** The persona and rules, then who made the plan and its line as `/hepit` shows it; `rules` replaces them for the eval. */
export function buildPlanCommentMessages(planLine: string, creatorName: string, rules = loadCommentPrompt()): OllamaMessage[] {
  const plan = [`Suunnitelman teki: ${creatorName}`, `Suunnitelma: ${planLine}`, "", "Kommentoi lyhyesti Saken tyylillä."].join("\n");

  return [
    { role: "system", content: rules },
    { role: "user", content: plan },
  ];
}

/**
 * The rules, then the message with its writer and a calendar of the coming days. `today` is
 * `YYYY-MM-DD`; `rules` replaces the prompt file, so the eval can try variants of it.
 */
export function buildPlanReaderMessages(text: string, writerName: string, today: string, rules = loadReaderPrompt()): OllamaMessage[] {
  const question = [`Kirjoittaja: ${writerName}`, "", "Kalenteri:", ...formatCalendar(today), "", `Viesti: ${text}`].join("\n");

  return [
    { role: "system", content: rules },
    { role: "user", content: question },
  ];
}

/**
 * Today and the next 13 days, so the model looks a day up instead of counting to it: models get
 * "lauantaina" asked on a Sunday wrong. Finnish weeks start on Monday.
 */
function formatCalendar(today: string): string[] {
  const lines: string[] = [];
  let weeksAhead = 0;

  for (let offset = 0; offset < CALENDAR_DAYS; offset++) {
    const day = addDays(today, offset);
    if (offset > 0 && weekdayOf(day) === MONDAY) weeksAhead++;

    const label = RELATIVE_DAY_LABELS[offset];
    lines.push(`- ${formatDay(day)} = ${day}, ${WEEK_LABELS[weeksAhead]}${label ? `, ${label}` : ""}`);
  }

  return lines;
}

/** "lauantai (la) 10.10.2026". */
function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = weekdayOf(day);

  return `${WEEKDAY_NAMES[weekday]} (${WEEKDAY_SHORT[weekday]}) ${date}.${month}.${year}`;
}
