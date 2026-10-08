export const gameMessages = {
  kukakirjaaUsage:  "Anna pelaajat välilyönnillä eroteltuna.",
  kukakirjaaIntro:  "🎵 On arvontalaulun aika! 🎵",
  kukakirjaaWinner: (name: string) => `🎆🎆🎆   Ja voittaja on ${name}!!! ONNEKSI OLKOON!   🎆🎆🎆`,

  gifplzUsage:      "Anna hakusana.",
};

/** Game planning: /hep, /pelei, /mukaan, /pois, /peru. */
export const planningMessages = {
  hepUsage:         "Kerro milloin ja missä! Esim: /hep la 18 Keljo tai /hep huomenna klo 9.00 Karjaa + Härkälinna",
  hepFreeText:      "En vielä ymmärrä vapaata tekstiä. Kirjoita päivä tai kellonaika ensin, esim: /hep la 18 Keljo",
  hepNoCourses:     "Missä pelataan? Lisää rata, esim: /hep la 18 Keljo",
  hepPast:          "Toi päivä on jo mennyt, urpo.",
  hepTooFar:        (maxDaysAhead: number) => `Noin pitkälle ei suunnitella, korkeintaan ${maxDaysAhead} päivää eteenpäin.`,
  hepSaved:         (planId: number, summary: string) => `Tallennettu nro ${planId}: ${summary}\nMukaan: /mukaan ${planId}`,
  noSender:         "En tiedä kuka olet, joten en voi tallentaa.",

  peleiNone:        "Ei suunniteltuja pelejä. Heitä /hep ja houkuttele muut mukaan!",
  peleiHeader:      "Tulevat pelit:\n\n",
  peleiFooter:      "\n\nMukaan: /mukaan <nro>",

  planNumberUsage:  (command: string) => `Anna pelin numero. Esim: /${command} 12 (näkyy /pelei-listassa)`,
  noPlan:           "Ei löydy tommosta peliä tästä ryhmästä.",
  joined:           (name: string, planId: number) => `${name} mukana pelissä ${planId}!`,
  alreadyIn:        (name: string) => `${name} on jo mukana.`,
  nameTooLong:      (maxLength: number) => `Nimi voi olla enintään ${maxLength} merkkiä.`,
  left:             (name: string, planId: number) => `${name} pois pelistä ${planId}.`,
  notInPlan:        (name: string) => `${name} ei ole mukana siinä pelissä.`,
  cancelled:        (planId: number) => `Peli ${planId} peruttu.`,
  notCreator:       "Vain pelin tekijä voi perua sen.",
};
