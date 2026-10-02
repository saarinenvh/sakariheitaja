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
