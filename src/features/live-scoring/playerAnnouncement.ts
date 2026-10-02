import { escapeHtml } from "../../shared/html";
import { truncateCourseName } from "../commentary/format/courseName";

/** The message that starts following: the course, the tracked players, and who still has no bagtag. */
export function formatPlayerAnnouncement(
  metrixId: string, courseName: string, playerNames: readonly string[], missingTags: readonly string[],
): string {
  const course = `<a href="https://discgolfmetrix.com/${metrixId}">${escapeHtml(truncateCourseName(courseName))}</a>`;
  let message = `Peliareenana toimii ${course}\n\nJa tällä kertaa kisassa on mukana:\n`;
  for (const name of playerNames) message += `${escapeHtml(name)}\n`;
  if (missingTags.length > 0) {
    message += `\n🏷️ Ilman tägiä: ${missingTags.map(escapeHtml).join(", ")}\nAseta: /bagtag set [nimi] [numero]`;
  }
  return message;
}
