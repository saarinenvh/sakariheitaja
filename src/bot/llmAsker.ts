import { generate, loadPrompt, loadContext } from "../shared/llm/ollamaClient";
import { fetchBracket } from "../shared/challonge";
import Logger from "js-logger";

// Cached separately from the match-play context below: this is the model's
// general identity/knowledge, safe to keep loaded for every question. The
// match-play file is NOT included here on purpose - see getMatchplayContext.
let baseSystemPrompt: string | null = null;

function getBaseSystemPrompt(): string {
  if (!baseSystemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("asker.md");
    const context = loadContext(["seura_context.md", "sankaritour_context.md"]);
    baseSystemPrompt = context ? `${persona}\n\n---\n\n${base}\n\n---\n\n${context}` : `${persona}\n\n---\n\n${base}`;
  }
  return baseSystemPrompt;
}

// matchplay_context.md is packed with example Q&A framing ("kuka on seuraava
// vastustajani", "kuka on pudonnut"...) written to help the model use real
// bracket data once it's fetched. Loaded into EVERY question's system prompt
// unconditionally, that framing dominated the model's attention regardless of
// what was actually asked - confirmed live: messages that never mentioned
// match play at all ("taasko se alko sakkee kiusaamaa", "koskas mennää sakke
// pelaamaa") got answered with fabricated "your opponent is TBD" bracket
// talk, including "Sakke" itself hallucinated as an opponent name - nothing
// in seura_context.md supports that, Sakke is defined there as the bot/
// mascot. Loading this file only when the question is actually about match
// play removes the framing entirely for everything else.
let matchplayContext: string | null = null;

function getMatchplayContext(): string {
  if (matchplayContext === null) {
    matchplayContext = loadContext(["matchplay_context.md"]);
  }
  return matchplayContext;
}

const MATCH_PLAY_KEYWORDS = ["reikäpeli", "match play", "matchplay", "bracket", "vastustaj", "eliminoi", "pudonneet", "pudonnut", "kaavio", "turnauskaavio"];

function isMatchPlayQuestion(text: string): boolean {
  return MATCH_PLAY_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

export async function llmAnswer(question: string, senderName?: string, recentMessages?: string[]): Promise<string | null> {
  try {
    const contextBlock = recentMessages?.length
      ? `[Viimeisimmät viestit chatissa]\n${recentMessages.map((m, i) => `${i + 1}. "${m}"`).join("\n")}\n\n`
      : "";
    let userContent = `${contextBlock}${senderName ? `[Kysyjä: ${senderName}]\n` : ""}${question}`;

    // Static context files (sankaritour_context.md's whole 2026 schedule) have
    // no way to express "today" on their own - without this, the model has no
    // basis for telling a past round from an upcoming one and has been
    // observed answering with a date four months gone. See systemPrompt.ts's
    // clockLine() in sakke-gateway for the same problem solved the same way.
    const today = new Date().toISOString().slice(0, 10);
    let systemContent = `${getBaseSystemPrompt()}\n\n---\n\n[Tämän päivän päivämäärä: ${today}]`;

    if (isMatchPlayQuestion(question)) {
      const matchplay = getMatchplayContext();
      if (matchplay) systemContent += `\n\n---\n\n${matchplay}`;
      try {
        const bracket = await fetchBracket();
        Logger.info(`Bracket fetched (${bracket.length} chars): ${bracket.slice(0, 300)}`);
        userContent += `\n\n[Bracket data]\n${bracket}`;
      } catch (err: any) {
        Logger.warn(`Bracket fetch failed: ${err.message}`);
        userContent += `\n\n[Bracket data ei ollut saatavilla juuri nyt - älä keksi vastausta bracketista, sano ettet saanut haettua tietoa.]`;
      }
    }

    const answer = await generate(
      [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent },
      ],
      { temperature: 0.6, num_predict: 350, num_ctx: 4096 },
    );
    return answer;
  } catch (err: any) {
    Logger.warn(`LLM asker failed: ${err.message}`);
    return null;
  }
}
