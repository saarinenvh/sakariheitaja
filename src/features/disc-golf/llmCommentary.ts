import { generate, loadPrompt, OllamaMessage } from "../../shared/llm/ollamaClient";
import { generateComment } from "./commentary";
import { buildCommentaryBrief, buildPromptFromBrief } from "./commentaryBrief";
import { Change, MetrixPlayerResult } from "../../types/metrix";
import { initTracker, clearTracker, recordEvent, shouldResetConversation, buildSummary } from "./roundTracker";
import Logger from "js-logger";

let systemPrompt: string | null = null;

// One conversation history per active competition (keyed by metrixId)
const conversations = new Map<string, OllamaMessage[]>();

function getSystemPrompt(): string {
  if (!systemPrompt) {
    const persona = loadPrompt("persona.md");
    const base = loadPrompt("commentator.md");
    const vocabulary = loadPrompt("disc_golf_vocabulary.md");
    systemPrompt = `${persona}\n\n---\n\n${base}\n\n---\n\n${vocabulary}`;
  }
  return systemPrompt;
}

export function startConversation(metrixId: string): void {
  conversations.set(metrixId, []);
  initTracker(metrixId);
  Logger.info(`LLM conversation started for competition ${metrixId}`);
}

export function clearConversation(metrixId: string): void {
  conversations.delete(metrixId);
  clearTracker(metrixId);
  Logger.info(`LLM conversation cleared for competition ${metrixId}`);
}

function resetWithSummary(metrixId: string, summary: string): void {
  conversations.set(metrixId, [
    { role: "user", content: summary },
    { role: "assistant", content: "Selvä, jatkan kommentointia tästä." },
  ]);
  Logger.info(`LLM conversation reset with summary for ${metrixId}`);
}

function getHistory(metrixId: string): OllamaMessage[] {
  if (!conversations.has(metrixId)) {
    startConversation(metrixId);
  }
  return conversations.get(metrixId)!;
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

export async function generateLlmComment(change: Change, metrixId: string, results: MetrixPlayerResult[], chatId: number): Promise<string> {
  try {
    const brief = buildCommentaryBrief(change, results, chatId);
    const context = buildPromptFromBrief(brief);

    // Record event before potentially resetting
    recordEvent(metrixId, change);

    // Reset conversation with programmatic summary every SUMMARY_INTERVAL holes
    if (shouldResetConversation(metrixId, brief.holeNumber)) {
      const summary = buildSummary(metrixId, brief.holeNumber, brief.totalHoles, results);
      resetWithSummary(metrixId, summary);
    }

    const history = getHistory(metrixId);
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
