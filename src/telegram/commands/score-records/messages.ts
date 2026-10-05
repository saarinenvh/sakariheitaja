import { NotableScoreKind } from "../../../features/score-records";
export const scoreRecordMessages = {
  usage:            "Anna kentän nimi tai id. Esim: /tulokset Kaatis",
  ambiguousCourse:  (list: string) =>
    `Voisitko vittu ystävällisesti vähän tarkemmin ilmottaa, et mitä kenttää tarkotat.. Saatana.\n\nValitse esim näistä:\n${list}`,
  noResults:        "Eip löytyny tuloksia tolla hakusanalla :'(((",
  error:            "Jotain meni pieleen tuloksia hakiessa.",
  resultsHeader:    "Dodiin, kovimmista kovimmat on sit paukutellu tällästä menee, semi säälittävää mutta... Ei tässä muuta vois odottaakkaan.",
  results:          (course: string, rows: string) =>
    `********\t\t${course}\t\t********\n\n<code>Sija\tNimi\t\t\t\t\t\t\t\t\t\t\t\t\tTulos\n${rows}</code>`,
};


/** The words for one kind of special score. */
interface SpecialScoreWords {
  command: string;
  title: string;
  /** Partitive singular, as in "ei yhtään ässää". */
  none: string;
  help: string;
}

export const SPECIAL_SCORE_WORDS = {
  ace: { command: "assat", title: "🎯 Ässät", none: "ässää", help: "Tämän vuoden ässät: kuka eniten ja viimeisimmät." },
  eagle: { command: "eaglet", title: "🦅 Eaglet", none: "eaglea", help: "Tämän vuoden eaglet, samaan tapaan." },
  albatross: { command: "albatrossit", title: "🕊️ Albatrossit", none: "albatrossia", help: "Tämän vuoden albatrossit, samaan tapaan." },
} as const satisfies Record<NotableScoreKind, SpecialScoreWords>;

export const specialScoreMessages = {
  usage:            (command: string) => `/${command} [alltime] [kenttä, id tai pelaaja]`,
  thisYear:         (year: number) => `vuonna ${year}`,
  allTime:          "kaikkien aikojen",
  heading:          (title: string, period: string, subject: string | null) =>
    `<b>${title}</b> – ${period}${subject ? ` (${subject})` : ""}`,
  none:             (word: string, period: string) => `Ei yhtään ${word} ${period}. Säälittävää.`,
  latestHeader:     "Viimeisimmät:",
  latestLine:       (player: string, course: string | null, hole: number | null, date: string) =>
    `• ${player}${course ? ` – ${course}` : ""}${hole === null ? "" : `, väylä ${hole}`} (${date})`,
  ambiguousCourse:  (list: string, command: string) =>
    `Monta kenttää osu, valitse id:llä. Esim: /${command} 12\n\n${list}`,
  ambiguousPlayer:  (list: string) => `Monta pelaajaa osu, tarkenna nimeä:\n\n${list}`,
  notFound:         (query: string) => `Ei löytyny kenttää eikä pelaajaa hakusanalla "${query}".`,
  error:            "Jotain meni pieleen hakiessa.",
};
