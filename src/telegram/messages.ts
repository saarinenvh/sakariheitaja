export const competition = {
  followUsage:      "Anna metrixId komennon perään. Esim: /follow 12345",
  followNoNumber:   "Ei löydy numeroa viestistä, urpo.",
  followStarted:    "Okei, aletaan kattoo vähä kiekkogolffii (c) Ian Andersson",
  followNoPlayers:  "Ei löydy seurattavia pelaajia tästä kisasta. Lopetan seuraamisen.",
  followInvalid:    "Mitä sä säädät?? XD Laita se kisa julkiseks tai kokeile oikeeta osotetta!",

  lopetaUsage:      "Anna kisan id. Esim: /lopeta 42",
  lopetaOk:         "No olihan se kivaa taas, jatketaan ens kerralla.",
  lopetaNotFound:   "Eihän tommost kisaa ookkaa! URPå!",

  pelitHeader:      "Tällä hetkellä tuijotetaan kivikovana seuraavia blejä.\n\n",
  pelitNone:        "Eihän tässä nyt taas mitään ole käynnissä...",

  top5Usage:        "Jaa, vai että minkäs kisan top tulokset haluut? Kokeile vaik /pelit komentoo ja lisää kisan id /top5 komennon perään. Aasi!",
  top5NoneActive:   "Varmaa pitäis jotai kisaa seuratakki.",

  endSoon:          "Dodii, ne kisat oli sit siinä, tässä olis sit vielä lopputulokset!",

  scoreFound:       (name: string, diff: number | null, order: number | null) =>
    `${name} on tuloksessa ${diff ?? "?"} ja sijalla ${order ?? "?"}! Hienosti`,
  scoreNotFound:    "Eihän tommone äijä oo ees jäällä, urpo",
};

export const players = {
  lisaaUsage:         "Anna pelaajan nimi. Esim: /lisaa Matti Meikäläinen",
  playerAdded:        (name: string) => `Pelaaja ${name} lisätty seurattaviin pelaajiin.`,
  playerAlreadyAdded: (name: string) => `Pelaaja ${name} on jo seurattavissa pelaajissa.`,
  lisaaError:         "Jotain meni pieleen pelaajan lisäämisessä.",

  poistaUsage:        "Anna pelaajan nimi. Esim: /poista Matti Meikäläinen",
  playerNotInSystem:  (name: string) => `Pelaajaa ${name} ei löytynyt järjestelmästä`,
  playerRemoved:      (name: string) => `Pelaaja ${name} poistettu seurattavista pelaajista.`,
  playerNotTracked:   (name: string) => `Pelaajaa ${name} ei löytynyt seurattavista pelaajista`,
  poistaError:        "Jotain meni pieleen pelaajan poistamisessa.",

  pelaajatHeader:     "Seuraan seuraavia pelaajia: \n",
};

export const scores = {
  usage:            "Anna kentän nimi tai id. Esim: /tulokset Kaatis",
  ambiguousCourse:  (list: string) =>
    `Voisitko vittu ystävällisesti vähän tarkemmin ilmottaa, et mitä kenttää tarkotat.. Saatana.\n\nValitse esim näistä:\n${list}`,
  noResults:        "Eip löytyny tuloksia tolla hakusanalla :'(((",
  error:            "Jotain meni pieleen tuloksia hakiessa.",
  resultsHeader:    "Dodiin, kovimmista kovimmat on sit paukutellu tällästä menee, semi säälittävää mutta... Ei tässä muuta vois odottaakkaan.",
  results:          (course: string, rows: string) =>
    `********\t\t${course}\t\t********\n\n<code>Sija\tNimi\t\t\t\t\t\t\t\t\t\t\t\t\tTulos\n${rows}</code>`,
};

export const weather = {
  usage:      "Anna kaupunki. Esim: /saa Helsinki",
  intro:      "Oiskohan nyt hyvä hetki puhua säästä?",
  notFound:   (city: string) => `Mikä vitun ${city}? - Eihän tommosta mestaa oo ees olemassakaa.`,
};

export const recipe = {
  notFound: "Ei löydy reseptejä :'(",
};

export const fun = {
  kukakirjaaUsage:  "Anna pelaajat välilyönnillä eroteltuna.",
  kukakirjaaIntro:  "🎵 On arvontalaulun aika! 🎵",
  kukakirjaaWinner: (name: string) => `🎆🎆🎆   Ja voittaja on ${name}!!! ONNEKSI OLKOON!   🎆🎆🎆`,

  gifplzUsage:      "Anna hakusana.",
  hepUsage:         "Kerro suunnitelmasi!",
  jallu:            "JALLU!",

  peleiNone:        "Kukaan ei oo pelaamas tänään??? :'(",
  peleiHeader:      "Tän päivän gamepläännis ois seuraavanlaisia \n",
  peleiFooter:      "Supereit heittoi kaikille!!",

  apua: `Meikää saa käskyttää seuraavin ja vain seuraavin komennoin!\n
Bag Tag:
/bagtag — näytä bag tag tilanne
/bagtag set [nimi] [numero] — aseta tägi pelaajalle
/bagtag remove [nimi] — poista pelaajan tägi\n
Kilpailua seurailen seuraavasti:
/follow [metrixId] - Alan seuraamaan kyseistä kisaa ja kommentoin kisan tapahtumia.
/top5 - Kerron seurattavan kisan top-5 tilastot sarjoittain.
/score [Pelaajan nimi metrixissä] - Kerron kyseisen pelaajan tuloksen ja sijoituksen.
/lisaa [Pelaajan nimi metrixissä] - Lisään kyseisen pelaajan seurattaviin pelaajiin.
/lopeta - Lopetan kyseisen kisan seuraamisen.\n
Ja muuta hauskaa mitä hommailen:\n
/kukakirjaa [Pelaajien nimet välimerkein eroteltuna] - Arvon kirjaajan annetuista vaihtoehdoista
/hyva - Kyl te tiiätte! XD
/hep [Vapaa muotoinen teksti] - Tähän voi ilmottaa jos on menossa pelaamaan samana päivänä
/pelei - Listaa kaikki hep huudot`,
};
