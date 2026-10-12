import type { GreetingFacts } from "../../src/features/morning-greeting/facts";
import type { GreetingResult } from "../../src/features/morning-greeting/greetingWriter";
import { countSentences } from "../eval-shared/sentences";

export type CheckSeverity = "fail" | "warn";

export const CHECK_DESCRIPTIONS = {
  "fallback": "Model reply unusable or failed; the canned greeting would go out",
  "no-greeting": "Text doesn't open with a morning greeting (huomenta, aamua, …)",
  "clock-time": "Text names a time, which the games list gives",
  "foreign-script": "Text has letters outside the Latin alphabet (a model glitch)",
  "odd-letter": "Text has a Latin letter Finnish doesn't use, such as é (a model glitch)",
  "ball-word": "Ball-golf word (pallo) instead of kiekko",
  "weather-numbers": "Text gives a temperature or wind speed as a number, which the weather card gives",
  "sentence-count": "Text isn't 2–4 sentences",
  "emoji-or-hashtag": "Text has an emoji or a hashtag",
  "repeated-word": "The same word three or more times in a row (a model loop)",
  "invented-games": "Text says games were cancelled or people signed up on a day with no games",
  "wrong-count": "A number of games or players that isn't in the facts",
  "repeats-opening": "Opens the same way as one of the recent greetings",
  "copies-recent": "Repeats five or more words in a row from a recent greeting",
} as const;

export type CheckId = keyof typeof CHECK_DESCRIPTIONS;

export interface CheckFinding {
  check: CheckId;
  severity: CheckSeverity;
  detail: string;
}

const MIN_SENTENCES = 2;
const MAX_SENTENCES = 4;
/** Shorter runs of shared words are ordinary Finnish ("tänään ei oo sovittu"); five is a copied phrase. */
const COPIED_PHRASE_WORDS = 5;

// "HYVÄÄ HUOMENTA", "Huomenta porukka", "Aamua", "Huomenia"; not "Huomenna" or "Aamulla".
const GREETING_OPENING = /^[\s"'“”„–-]*(?:hyvää\s+)?(?:huomenta|huomenia|huomentaa|aamua|aamuja|aamu)(?!\p{L})/iu;
// "klo 18", "kello 9", "18.00"; a date like "10.10." (a month after the dot) is not a time.
const CLOCK_TIME = /(?<!\p{L})(?:klo|kello)(?!\p{L})|(?<!\d)\d{1,2}(?::\d{2}|\.(?!(?:0[1-9]|1[0-2])\.)\d{2})(?!\d)/iu;
const FOREIGN_LETTER = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
// Finnish letters plus the å; any other Latin letter (é, ñ, ø, …) is a glitch in a greeting.
const ODD_LETTER = /(?![a-zåäö])\p{Script=Latin}/iu;
const BALL_WORD = /(?<!\p{L})pallo\p{L}*/iu;
const EMOJI_OR_HASHTAG = /\p{Extended_Pictographic}|#\p{L}/u;
const REPEATED_WORD = /(?<!\p{L})(\p{L}+)(?:[\s,.!?…]+\1(?!\p{L})){2,}/iu;
const NO_GAMES_CLAIM = /perut\p{L}*|ilmoi?ttautu\p{L}*/iu;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  yks: 1, yksi: 1, kaks: 2, kaksi: 2, kolme: 3, neljä: 4, viis: 5, viisi: 5, kuus: 6, kuusi: 6,
  seittemän: 7, seitsemän: 7, kaheksan: 8, kahdeksan: 8, yheksän: 9, yhdeksän: 9, kymmenen: 10,
  yksitoista: 11, kaksitoista: 12, kolmetoista: 13, neljätoista: 14, viisitoista: 15,
};
// "+3 astetta", "kolme asteen pakkanen", "yhdeksän metriä sekunnissa", "Turussa +26", "plus 3".
const WEATHER_NUMBER = new RegExp(
  `(?<!\\p{L})(?:\\d+(?:[,.]\\d+)?|${Object.keys(NUMBER_WORDS).join("|")})\\s*(?:°|aste\\p{L}*|m\\/s|metri\\p{L}*)`
    + "|(?<!\\S)[+−-]\\d+|(?<!\\p{L})(?:plus|miinus)\\s*\\d+",
  "iu",
);
// A count right before what it counts: games ("kaks peliä", "kolme eri porukkaa", a group being one game)
// and players ("kuusi pelaajaa", "3 sankaria").
const countBefore = (nouns: string) => new RegExp(
  `(?<!\\p{L})(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\s+(?:eri\\s+)?(?:${nouns})`, "giu",
);
const GAMES_COUNTED = countBefore("pel(?!aaj)\\p{L}*|porukk\\p{L}*");
const PLAYERS_COUNTED = countBefore("pelaaj\\p{L}*|sankar\\p{L}*|tyyp\\p{L}*|ihmi\\p{L}*");

export function runChecks(facts: GreetingFacts, result: GreetingResult): CheckFinding[] {
  if (result.kind === "fallback") return [{ check: "fallback", severity: "fail", detail: result.reason }];

  const text = result.reply.text;
  const findings: CheckFinding[] = [];
  const add = (check: CheckId, severity: CheckSeverity, pattern: RegExp) => {
    const match = text.match(pattern);
    if (match) findings.push({ check, severity, detail: `"${match[0]}"` });
  };

  if (!GREETING_OPENING.test(text)) findings.push({ check: "no-greeting", severity: "fail", detail: `opens "${opening(text)}"` });
  add("clock-time", "fail", CLOCK_TIME);
  add("foreign-script", "fail", FOREIGN_LETTER);
  add("odd-letter", "warn", ODD_LETTER);
  add("ball-word", "warn", BALL_WORD);
  add("weather-numbers", "warn", WEATHER_NUMBER);
  add("emoji-or-hashtag", "warn", EMOJI_OR_HASHTAG);
  add("repeated-word", "warn", REPEATED_WORD);
  if (facts.todaysGames.length === 0) add("invented-games", "warn", NO_GAMES_CLAIM);

  const sentences = countSentences(text);
  if (sentences < MIN_SENTENCES || sentences > MAX_SENTENCES) {
    findings.push({ check: "sentence-count", severity: "warn", detail: `${sentences} sentences` });
  }

  findings.push(...checkCounts(facts, text));
  findings.push(...checkRecent(facts.recentGreetings, text));
  return findings;
}

/** Up to two words before the first punctuation, lowercased: how the greeting opens, for the variety summary. */
export function opening(text: string): string {
  const firstPhrase = text.trim().split(/[.,!?…]/u)[0];
  return firstPhrase.split(/\s+/u).filter(Boolean).slice(0, 2).join(" ").toLocaleLowerCase("fi");
}

/** A count of games must be the number of games; a count of players, one game's players or all of them. */
function checkCounts(facts: GreetingFacts, text: string): CheckFinding[] {
  const players = facts.todaysGames.map(game => game.players);
  const allPlayers = players.reduce((sum, count) => sum + count, 0);

  return [
    ...countsNotIn(text, GAMES_COUNTED, [facts.todaysGames.length]),
    ...countsNotIn(text, PLAYERS_COUNTED, [...players, allPlayers]),
  ];
}

function countsNotIn(text: string, pattern: RegExp, allowed: readonly number[]): CheckFinding[] {
  return [...text.matchAll(pattern)]
    .filter(match => !allowed.includes(toNumber(match[1])))
    .map(match => ({ check: "wrong-count", severity: "warn", detail: `"${match[0]}"` }));
}

/** The opening and phrases of the recent greetings, which the new one shouldn't repeat. */
function checkRecent(recentGreetings: readonly string[], text: string): CheckFinding[] {
  const findings: CheckFinding[] = [];

  const sameOpening = recentGreetings.filter(recent => opening(recent) === opening(text)).length;
  if (sameOpening > 0) {
    findings.push({ check: "repeats-opening", severity: "warn", detail: `"${opening(text)}", as ${sameOpening} of the recent` });
  }

  const copied = copiedPhrase(recentGreetings, text);
  if (copied) findings.push({ check: "copies-recent", severity: "warn", detail: `"${copied}"` });

  return findings;
}

/** The first run of `COPIED_PHRASE_WORDS` words the text shares with a recent greeting, or null. */
function copiedPhrase(recentGreetings: readonly string[], text: string): string | null {
  const recentPhrases = new Set(recentGreetings.flatMap(recent => phrases(words(recent))));
  return phrases(words(text)).find(phrase => recentPhrases.has(phrase)) ?? null;
}

function words(text: string): string[] {
  return text.toLocaleLowerCase("fi").split(/[^\p{L}\d]+/u).filter(Boolean);
}

function phrases(textWords: readonly string[]): string[] {
  return textWords.slice(0, Math.max(0, textWords.length - COPIED_PHRASE_WORDS + 1))
    .map((_word, index) => textWords.slice(index, index + COPIED_PHRASE_WORDS).join(" "));
}

function toNumber(word: string): number {
  return NUMBER_WORDS[word.toLocaleLowerCase("fi")] ?? Number(word);
}
