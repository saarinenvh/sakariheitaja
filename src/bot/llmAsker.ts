import { generate, loadPrompt, loadContext } from "../shared/llm/ollamaClient";
import { fetchBracketData, findParticipantsByName, findPlayerMatch, formatFullBracket, type BracketData } from "../shared/challonge";
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

// Gates whether match play is in play at all (loads matchplay_context.md,
// triggers a bracket fetch). OPPONENT_KEYWORDS is the subset that specifically
// asks "who do I/they play next" - the one question findPlayerMatch can
// answer with a single line instead of the whole bracket. Anything else that
// matched (eliminoi, pudonneet, kaavio, "missä kohdassa ollaan") is a broader
// question a single match can't answer, so it falls back to the full dump.
const MATCH_PLAY_KEYWORDS = ["reikäpeli", "match play", "matchplay", "bracket", "vastustaj", "eliminoi", "pudonneet", "pudonnut", "kaavio", "turnauskaavio"];
const OPPONENT_KEYWORDS = ["vastustaj", "seuraava peli", "seuraavaks", "pelaan seuraavaksi", "ketä vastaan"];

export function isMatchPlayQuestion(text: string): boolean {
  return MATCH_PLAY_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

export function isOpponentQuestion(text: string): boolean {
  return OPPONENT_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

// A name explicitly mentioned in the question wins over the asker's own name -
// matchplay_context.md's own established rule: "ketä vastaan Turkalla on
// seuraava peli" means find Turkka, not the person asking. Falls back to
// whoever's asking when no other name is mentioned.
//
// A single word can be genuinely ambiguous (a bare "Ville" against both
// "Ville Saarinen" and "Ville Liedes") without the question as a whole being
// unresolvable - scanning every word means a last name elsewhere in the same
// sentence ("Ville Saarinen pelaa...") still disambiguates it. Only when
// nothing in the question or the sender's own name resolves to exactly one
// person does this give up and let the caller fall back to the full bracket
// dump - guessing which Ville was meant is worse than not guessing.
export function resolveTargetPlayer(data: BracketData, question: string, senderName?: string): { id: number; name: string } | null {
  const words = question.split(/\s+/);
  let sawAmbiguous = false;

  for (const word of words) {
    const cleaned = word.replace(/[.,!?:;]+$/, "");
    if (cleaned.length < 3) continue;
    const matches = findParticipantsByName(data, cleaned);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) sawAmbiguous = true;
  }

  if (senderName) {
    const matches = findParticipantsByName(data, senderName);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) sawAmbiguous = true;
  }

  if (sawAmbiguous) {
    Logger.warn(`Bracket name lookup ambiguous for question "${question}" / sender "${senderName}" - falling back to full bracket rather than guessing`);
  }
  return null;
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
        const data = await fetchBracketData();

        // The common case ("who do I play next") gets one deterministic line
        // instead of the entire bracket as text - both cheaper (a few dozen
        // bytes instead of a few thousand) and more reliable, since finding
        // the right match among ~60 was the actual thing the model kept
        // getting wrong, not something worth re-litigating in a prompt.
        const target = isOpponentQuestion(question) ? resolveTargetPlayer(data, question, senderName) : null;
        const targeted = target ? findPlayerMatch(data, target.id) : null;

        if (targeted) {
          Logger.info(`Targeted bracket lookup for ${target!.name}: ${targeted}`);
          userContent += `\n\n[Bracket-tieto]\n${targeted}`;
        } else {
          const bracket = formatFullBracket(data);
          Logger.info(`Full bracket fetched (${bracket.length} chars): ${bracket.slice(0, 300)}`);
          userContent += `\n\n[Bracket data]\n${bracket}`;
        }
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
      // 4096 measured too tight once matchplay_context.md and a full bracket
      // dump both land in the same prompt - ballparked at ~5,100 tokens
      // worst case (persona/asker/seura/tour ~3,050 + matchplay_context.md
      // ~545 + a ~60-match bracket dump ~1,050 + num_predict 350), over the
      // old budget. The targeted lookup above removes that worst case for the
      // single most common question, but the full-dump fallback still exists
      // for broader questions, so the budget needs the headroom regardless.
      { temperature: 0.6, num_predict: 350, num_ctx: 8192 },
    );
    return answer;
  } catch (err: any) {
    Logger.warn(`LLM asker failed: ${err.message}`);
    return null;
  }
}
