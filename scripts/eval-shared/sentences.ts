/** Sentences split at . ! ? or …; a part without letters (a lone emoji or number) isn't one. */
export function countSentences(text: string): number {
  return text.trim().split(/(?<=[.!?…])\s+/u).filter(part => /\p{L}/u.test(part)).length;
}
