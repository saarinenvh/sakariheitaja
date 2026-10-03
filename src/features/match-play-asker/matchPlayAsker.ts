import { OllamaClient } from "../../integrations/ollama/client";
import { ChallongeClient } from "../../integrations/challonge/client";
import { findPlayerMatch, formatFullBracket, resolveTargetPlayer } from "./bracket";
import { isMatchPlayQuestion, isOpponentQuestion } from "./policy";
import { BracketFacts, buildAskerQuestion, buildAskerSystemPrompt, formatBracketFacts } from "./prompts";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("asker");

/** What the asker talks to: the model, and Challonge for match-play questions. */
export interface AskerClients {
  ollama: OllamaClient;
  challonge: ChallongeClient;
}

export async function llmAnswer(
  clients: AskerClients, question: string, senderName?: string, recentMessages?: string[],
): Promise<string | null> {
  try {
    let userContent = buildAskerQuestion(question, senderName, recentMessages);
    const today = new Date().toISOString().slice(0, 10);
    const matchPlay = isMatchPlayQuestion(question);
    const systemContent = buildAskerSystemPrompt(today, matchPlay);

    if (matchPlay) {
      userContent += formatBracketFacts(await fetchBracketFacts(clients.challonge, question, senderName));
    }

    const answer = await clients.ollama.generate(
      [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent },
      ],
      // Sized for the worst case: every context file plus a full bracket dump.
      { temperature: 0.6, num_predict: 350, num_ctx: 8192 },
    );
    return answer;
  } catch (err: any) {
    log.warn({ err }, "LLM asker failed");
    return null;
  }
}

/** One line for "who plays next" when the player resolves, otherwise the whole bracket. */
async function fetchBracketFacts(challonge: ChallongeClient, question: string, senderName?: string): Promise<BracketFacts> {
  try {
    const data = await challonge.fetchBracket();
    const target = isOpponentQuestion(question) ? resolveTargetPlayer(data, question, senderName) : null;
    const targeted = target ? findPlayerMatch(data, target.id) : null;

    if (target && targeted) {
      log.info({ player: target.name, result: targeted }, "targeted bracket lookup");
      return { kind: "targeted", line: targeted };
    }
    const bracket = formatFullBracket(data);
    log.info({ chars: bracket.length, preview: bracket.slice(0, 300) }, "full bracket fetched");
    return { kind: "full", bracket };
  } catch (err: any) {
    log.warn({ err }, "bracket fetch failed");
    return { kind: "unavailable" };
  }
}
