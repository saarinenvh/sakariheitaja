import { loadContext, loadPrompt } from "../../prompts/prompts";

// The persona, the asker prompt and the club context, kept for every question. The match-play
// context is separate and added only to match-play questions (see policy.ts).
let baseSystemPrompt: string | null = null;
let matchplayContext: string | null = null;

function getBaseSystemPrompt(): string {
  if (!baseSystemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("asker.md");
    const context = loadContext(["seura_context.md", "sankaritour_context.md"]);
    baseSystemPrompt = context ? `${persona}\n\n---\n\n${base}\n\n---\n\n${context}` : `${persona}\n\n---\n\n${base}`;
  }
  return baseSystemPrompt;
}

function getMatchplayContext(): string {
  if (matchplayContext === null) {
    matchplayContext = loadContext(["matchplay_context.md"]);
  }
  return matchplayContext;
}

/** The system prompt with today's date, which the static context files can't express; plus the match-play context when asked. */
export function buildAskerSystemPrompt(today: string, includeMatchPlay: boolean): string {
  let systemContent = `${getBaseSystemPrompt()}\n\n---\n\n[Tämän päivän päivämäärä: ${today}]`;
  if (includeMatchPlay) {
    const matchplay = getMatchplayContext();
    if (matchplay) systemContent += `\n\n---\n\n${matchplay}`;
  }
  return systemContent;
}

/** The user message: the chat's recent messages, who asks, and the question. */
export function buildAskerQuestion(question: string, senderName?: string, recentMessages?: string[]): string {
  const contextBlock = recentMessages?.length
    ? `[Viimeisimmät viestit chatissa]\n${recentMessages.map((m, i) => `${i + 1}. "${m}"`).join("\n")}\n\n`
    : "";
  return `${contextBlock}${senderName ? `[Kysyjä: ${senderName}]\n` : ""}${question}`;
}

/** The bracket facts appended to the question: one player's next match, the whole bracket, or that it is unavailable. */
export type BracketFacts =
  | { kind: "targeted"; line: string }
  | { kind: "full"; bracket: string }
  | { kind: "unavailable" };

export function formatBracketFacts(facts: BracketFacts): string {
  switch (facts.kind) {
    case "targeted": return `\n\n[Bracket-tieto]\n${facts.line}`;
    case "full": return `\n\n[Bracket data]\n${facts.bracket}`;
    case "unavailable": return `\n\n[Bracket data ei ollut saatavilla juuri nyt - älä keksi vastausta bracketista, sano ettet saanut haettua tietoa.]`;
  }
}
