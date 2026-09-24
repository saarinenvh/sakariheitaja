import { generate, loadPrompt, OllamaMessage } from "../../shared/llm/ollamaClient";
import { generateComment } from "./commentary";
import { buildCommentaryBrief, buildPromptFromBrief } from "./commentaryBrief";
import { Change, MetrixPlayerResult } from "../../types/metrix";
import { initTracker, clearTracker, recordEvent, shouldResetConversation, buildSummary } from "./roundTracker";
import Logger from "js-logger";

let systemPrompt: string | null = null;

// One conversation history per active competition AND division. Keying by
// metrixId alone meant every division in a competition shared a single history
// and a single running summary, so while commentating an MA3 hole the model was
// being fed the MPO leaders' birdies as recent context - and the periodic
// summary (roundTracker) mixed both divisions' standings into one list of
// "facts" it was told to rely on.
const conversations = new Map<string, OllamaMessage[]>();

const KEY_SEPARATOR = "::";

function conversationKey(metrixId: string, division: string): string {
  return `${metrixId}${KEY_SEPARATOR}${division}`;
}

function getSystemPrompt(): string {
  if (!systemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("commentator.md");
    const vocabulary = loadPrompt("disc_golf_vocabulary.md");
    systemPrompt = `${persona}\n\n---\n\n${base}\n\n---\n\n${vocabulary}`;
  }
  return systemPrompt;
}

// A competition's divisions aren't known until results actually arrive, so
// per-division histories are created lazily on that division's first comment.
// This just clears anything left over from a previous run of the same
// competition.
export function startConversation(metrixId: string): void {
  clearConversation(metrixId);
  Logger.info(`LLM conversations ready for competition ${metrixId}`);
}

export function clearConversation(metrixId: string): void {
  const prefix = `${metrixId}${KEY_SEPARATOR}`;
  let cleared = 0;
  for (const key of [...conversations.keys()]) {
    if (key.startsWith(prefix)) {
      conversations.delete(key);
      cleared++;
    }
  }
  clearTracker(metrixId);
  Logger.info(`LLM conversations cleared for competition ${metrixId} (${cleared} division(s))`);
}

function resetWithSummary(key: string, summary: string): void {
  conversations.set(key, [
    { role: "user", content: summary },
    { role: "assistant", content: "Selvä, jatkan kommentointia tästä." },
  ]);
  Logger.info(`LLM conversation reset with summary for ${key}`);
}

function getHistory(key: string): OllamaMessage[] {
  if (!conversations.has(key)) {
    conversations.set(key, []);
    Logger.info(`LLM conversation started for ${key}`);
  }
  return conversations.get(key)!;
}

function addPlusSign(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

function holeScoreLabel(diff: number, result: string): string {
  if (parseInt(result) === 1) return "ässä";
  if (diff <= -3) return "albatrossi";
  if (diff === -2) return "kotka";
  if (diff === -1) return "birdie";
  if (diff === 0)  return "par";
  if (diff === 1)  return "bogi";
  if (diff === 2)  return "tuplabogi";
  return `+${diff}`;
}

function buildStructuredTail(change: Change): string {
  const { newPlayer, prevPlayer, holeResult } = change;
  const score = holeScoreLabel(holeResult.Diff, holeResult.Result);
  const ob = holeResult.PEN > 0 ? " (ob)" : "";
  let meta = `${score}${ob} | ${newPlayer.Name} | ${addPlusSign(newPlayer.Diff)} | sija ${newPlayer.OrderNumber}`;

  if (newPlayer.OrderNumber !== prevPlayer.OrderNumber) {
    meta += newPlayer.OrderNumber < prevPlayer.OrderNumber ? " ↑" : " ↓";
  }

  return `\n<blockquote>${meta}</blockquote>`;
}

// `results` is expected to be narrowed to this change's own division already -
// formatCommentaryMessage does that. The division is still read off the change
// here, because it also decides which conversation history this comment belongs
// to.
export async function generateLlmComment(change: Change, metrixId: string, results: MetrixPlayerResult[], chatId: number): Promise<string> {
  try {
    const key = conversationKey(metrixId, change.newPlayer.ClassName);
    const brief = buildCommentaryBrief(change, results, chatId);
    const context = buildPromptFromBrief(brief);

    // Record event before potentially resetting
    recordEvent(key, change);

    // Reset conversation with programmatic summary every SUMMARY_INTERVAL holes
    if (shouldResetConversation(key, brief.holeNumber)) {
      const summary = buildSummary(key, brief.holeNumber, brief.totalHoles, results);
      resetWithSummary(key, summary);
    }

    // Must stay after the reset above - resetWithSummary swaps in a new array,
    // so a reference taken earlier would be the discarded one.
    const history = getHistory(key);
    history.push({ role: "user", content: context });

    const messages: OllamaMessage[] = [
      { role: "system", content: getSystemPrompt() },
      ...history,
    ];

    const flavor = (await generate(
      messages,
      { temperature: 0.9, num_predict: 100, num_ctx: 8192, repeat_penalty: 1.5 },
    )).replace(/\n+/g, " ").trim();

    const PROMPT_LEAK_MARKERS = ["Pelaaja:", "Reaktiovihjeitä:", "Tulosnimivaihtoehtoja:", "Verbivaihtoehtoja:", "Kirjoita 2", "Kirjoita 3", "Kirjoita vain"];
    if (PROMPT_LEAK_MARKERS.some(m => flavor.includes(m))) {
      Logger.warn(`LLM commentary prompt leak detected, using fallback`);
      history.pop();
      return generateComment(change, results);
    }

    history.push({ role: "assistant", content: flavor });

    return `${flavor} ${buildStructuredTail(change)}`;
  } catch (err: any) {
    Logger.warn(`LLM commentary failed, using fallback: ${err.message}`);
    return generateComment(change, results);
  }
}
