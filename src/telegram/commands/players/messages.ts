export const playerMessages = {
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
