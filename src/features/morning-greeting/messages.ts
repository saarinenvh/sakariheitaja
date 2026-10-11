import { escapeHtml } from "../../shared/html";

/** The canned greeting (HTML), when the model doesn't write one: the opening line, then the time. */
export function formatFallbackGreeting(greeting: string, clockTime: string): string {
  return `${escapeHtml(greeting)}Kello on <b>${clockTime}</b> &amp; tämmöstä keliä ois sit tänää taas luvassa.`;
}

export const gamesJoinLine = "Liity mukaan SakariPelit kanavalla!";
