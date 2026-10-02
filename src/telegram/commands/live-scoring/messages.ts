export const liveScoringCommandMessages = {
  followUsage:      "Anna metrixId komennon perään. Esim: /follow 12345",
  followNoNumber:   "Ei löydy numeroa viestistä, urpo.",
  followStarted:    "Okei, aletaan kattoo vähä kiekkogolffii (c) Ian Andersson",

  lopetaUsage:      "Anna kisan metrixId. Esim: /lopeta 3809486 (näkyy /pelit-listassa)",
  lopetaOk:         "No olihan se kivaa taas, jatketaan ens kerralla.",
  lopetaNotFound:   "Eihän tommost kisaa ookkaa! URPå!",

  pelitHeader:      "Tällä hetkellä tuijotetaan kivikovana seuraavia blejä.\n\n",
  pelitNone:        "Eihän tässä nyt taas mitään ole käynnissä...",

  top5Usage:        "Jaa, vai että minkäs kisan top tulokset haluut? Kokeile vaik /pelit komentoo ja lisää kisan id /top5 komennon perään. Aasi!",
  top5NoneActive:   "Varmaa pitäis jotai kisaa seuratakki.",


  scoreFound:       (name: string, diff: number | null, order: number | null) =>
    `${name} on tuloksessa ${diff ?? "?"} ja sijalla ${order ?? "?"}! Hienosti`,
  scoreNotFound:    "Eihän tommone äijä oo ees jäällä, urpo",
};
