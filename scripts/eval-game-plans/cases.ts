// The game plan reader's eval cases: messages as club members write them, and what the reader must
// read from each. Names are made up (the repo is public); the courses are real places.

/** Thursday. */
export const DEFAULT_TODAY = "2026-10-08";
export const DEFAULT_WRITER = "Ville";

export interface ExpectedPlan {
  isPlan: true;
  /** Null when the message names no day: the bot, not the model, makes that today. */
  day: string | null;
  time: string | null;
  /** In the order they're played. */
  courses: string[];
  /** The other players, in any order; the writer only through `creatorPlays`. */
  players: string[];
  creatorPlays: boolean;
}

export interface EvalCase {
  name: string;
  text: string;
  /** `YYYY-MM-DD`; Thursday 8.10.2026 by default. */
  today?: string;
  expected: ExpectedPlan | { isPlan: false };
}

function plan(day: string | null, time: string | null, courses: string[], players: string[], creatorPlays: boolean): ExpectedPlan {
  return { isPlan: true, day, time, courses, players, creatorPlays };
}

const NOT_A_PLAN = { isPlan: false } as const;

export const evalCases: EvalCase[] = [
  // The owner's own shape of plan.
  { name: "with others, two courses, a weekday and a start", text: "pekan ja matin kanssa karjaa + härkälinna lauantaina. Lähtö 9.00.",
    expected: plan("2026-10-10", "09:00", ["Karjaa", "Härkälinna"], ["Pekka", "Matti"], true) },
  // Known limitation (accepted 2026-10-08): the capitalized first "Jorin" stays as written, since it
  // could be a name of its own. The confirmation shows it, and /pois and /mukaan fix it.
  { name: "three names in the genitive", text: "Jorin, Liisan ja Matin kanssa Taliin ylihuomenna",
    expected: plan("2026-10-10", null, ["Tali"], ["Jori", "Liisa", "Matti"], true) },
  { name: "one name, a date", text: "12.10. Härkälinna liisan kanssa",
    expected: plan("2026-10-12", null, ["Härkälinna"], ["Liisa"], true) },
  { name: "'tuun' with someone, no day", text: "tuun Pekan kanssa Taliin 18:30",
    expected: plan(null, "18:30", ["Tali"], ["Pekka"], true) },

  // Someone else's game: the writer doesn't play.
  { name: "two others play", text: "Pekka ja Matti pelaa su Keljo",
    expected: plan("2026-10-11", null, ["Keljo"], ["Pekka", "Matti"], false) },
  { name: "one other goes", text: "Liisa menee sunnuntaina Keljoon klo 10",
    expected: plan("2026-10-11", "10:00", ["Keljo"], ["Liisa"], false) },

  // Days.
  { name: "tomorrow", text: "pelataan huomenna Talissa klo 18",
    expected: plan("2026-10-09", "18:00", ["Tali"], [], true) },
  { name: "no day is left empty", text: "keljoon lähdetään kuudelta illalla",
    expected: plan(null, "18:00", ["Keljo"], [], true) },
  { name: "today's own weekday is today", text: "torstaina Karjaa klo 19",
    expected: plan("2026-10-08", "19:00", ["Karjaa"], [], true) },
  { name: "a weekday next week", text: "tiistaina Keljo",
    expected: plan("2026-10-13", null, ["Keljo"], [], true) },
  { name: "'ensi viikon' weekday", text: "ensi viikon tiistaina Tali klo 17.30",
    expected: plan("2026-10-13", "17:30", ["Tali"], [], true) },
  { name: "Saturday asked on a Sunday is next week's", text: "la Tali", today: "2026-10-11",
    expected: plan("2026-10-17", null, ["Tali"], [], true) },
  { name: "a weekday with no players or time", text: "mennään perjantaina härkälinnaan heti töiden jälkeen",
    expected: plan("2026-10-09", null, ["Härkälinna"], [], true) },

  // Times.
  { name: "half past", text: "huomenna puoli kymmeneltä Keljo",
    expected: plan("2026-10-09", "09:30", ["Keljo"], [], true) },
  { name: "'aamulla' is no time", text: "lauantaina aamulla karjaa",
    expected: plan("2026-10-10", null, ["Karjaa"], [], true) },

  // Courses.
  { name: "three courses in order", text: "la keljo, tali ja karjaa",
    expected: plan("2026-10-10", null, ["Keljo", "Tali", "Karjaa"], [], true) },
  { name: "an emoji and a question to the chat", text: "huomenna klo 17 tali 🥏 kuka mukaan?",
    expected: plan("2026-10-09", "17:00", ["Tali"], [], true) },
  { name: "said to Sakke", text: "Sakke, pelataan huomenna Talissa klo 18.",
    expected: plan("2026-10-09", "18:00", ["Tali"], [], true) },

  // Not plans: questions, chatter and past games, for the general asker.
  { name: "small talk", text: "mitä kuuluu?", expected: NOT_A_PLAN },
  { name: "a question about yesterday", text: "kuka voitti eilen?", expected: NOT_A_PLAN },
  { name: "a match-play question", text: "pelataanko reikäpeliä tänä vuonna?", expected: NOT_A_PLAN },
  { name: "the next match-play opponent", text: "kuka on seuraava vastustaja reikäpelissä?", expected: NOT_A_PLAN },
  { name: "a course fact", text: "mikä on Keljon par?", expected: NOT_A_PLAN },
  { name: "the weather yesterday", text: "oliko eilen hyvä keli Talissa?", expected: NOT_A_PLAN },
  { name: "news of a past round", text: "Pekka heitti eilen ässän Keljossa!", expected: NOT_A_PLAN },
  { name: "a question about last week", text: "pelattiinko viime lauantaina Karjaalla?", expected: NOT_A_PLAN },
];
