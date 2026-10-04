/**
 * The original procedural commentary, kept for nostalgia. Nothing imports this file.
 *
 * From 2019 until the commentary rebuild (#35, 2026-10-01) the bot built every comment by
 * picking random phrases from these pools; there was no model. Each update was one message:
 *
 *   <narrative>
 *
 *   ⛳ Väylä <hole> · <course link>
 *   ⭐ STARFRAME ⭐                  when several players scored birdie or better on the hole
 *
 *   <start> <b><name></b> <verb> <score><ob><place change><leader gap>
 *   > <name> | <score> | <total to par> | sija <place>
 *
 * The score type picked the pools: birdie or better took a `good` start, par a `neutral` one,
 * bogey or worse a `bad` one, and the score text came from `scoreTexts`. Anything worse than a
 * double bogey read `niin ison scoren, että ei mahdu edes näytölle (<strokes>)`. An OB phrase
 * was added when the hole had penalty strokes, and the place change and leader gap were
 * computed within the player's division.
 *
 * Example: "Voi surkujen surku! <b>Aki</b> rämisteli ruskean boggelin, oli muute viel <b>OB</b>
 * HÄHÄHÄHÄHÄ, putosi 2 sijaa"
 *
 * `throws` dates from the 2019 bot and `descriptions` from 2026; neither was ever used.
 */

export const narratives = [
  "Ihmiset ovat suorittaneet firsbeegolf heittoja!",
  "Jahas ja tilannekatsauksen aika!",
  "HOI! Nyt taas tapahtuu!",
  "HUOMIO!",
  "Ja taas mennään!",
  "HEIHEIHEI, joku teki jotain!",
  "Tulostaulussa liikehdintää!",
  "Ja taas on väyliä saatettu loppuun.",
];

export const scoreTexts = {
  ace:         ["ÄSSÄN!"],
  eagle:       ["eaglen?? SIIS EAGLEN! En usko", "KOTKAN", "EAGLEN"],
  albatross:   ["ALBATROSSIN?? Salee merkkausvirhe"],
  birdie:      ["birdien", "lintusen", "tirpan", "vitunmoisen tuuripörön", "pörön", "hemmetin kauniin pirkon", "pirkon"],
  par:         ["parin", "PROFESSIONAL AVERAGEN", "ihannetuloksen", "hemmetin tylsän paarin", "tuuripaarin", "scramblepaarin", "tsägällä paarin", "taitopaarin"],
  bogey:       ["bogin", "boggelin", "turhan bogin", "ruskean boggelin"],
  doubleBogey: ["ruman tuplabogin", "tsägällä tuplan", "kaks päälle", "DOUBLE BOGEYN"],
};

export const startTexts = {
  good: [
    "MAHTAVA SUORITUS!", "USKOMATON TEKO!", "ENNENÄKEMÄTÖNTÄ TOIMINTAA!",
    "Wouuuuu, kyllä nyt kelpaa!", "Mahtavaa peliä, ei voi muuta sanoa.",
    "Siis huhu, aika huikeeta!", "Tää dude on iha samaa tasoo ku pauli tai riki!",
    "Kyllä nyt ollaan sankareita!", "WOUUUUU!",
    "Hellurei hellurei vääntö on hurjaa!", "No nyt taas! Näin sen kuuluukin mennä!",
    "Olikohan vahinko, ei tämmöstä yleensä nähä!",
    "JUMALISTE! Oiskohan sittenki vielä sauma mitaleille!",
    "Tämmöstä! Tämmöstä sen olla pitää!", "Nyt ollaa jo lähellä tonninmiehen tasoa!",
    "JA MAALILAITE RÄJÄHTÄÄ!!", "Täällä taas nostellaan häränsilmästä limppuja!",
  ],
  bad: [
    "Voi surkujen surku!", "Voi kyynelten kyynel!", "No ohan tää vähän vaikee laji!",
    "Saatana vois tää spede vaik denffata.", "Kannattiko ees tulla näihin kisoihin??",
    "Säälittävää tekemistä taas...", "Naurettavaa toimintaa!", "Miten voi taas pelata näin?",
    "En voi uskoa silmiäni!", "Miten on mahdollista taas?", "Näkivätkö silmäni oikein?",
    "HAHAHAHAHAHA!", "😃😃😃😃😃",
    "Ei vittu, jopa mä oisin pöröttänu ton mut ei... Ei ei ei.", "Ei jumalauta!",
    "Vittu mitä paskaa, ei kiinnosta ees seurata tätä pelii jos taso on tää!!",
    "Siis mee roskii!", "Noh, toivottavasti ens kerralla käy parempi tuuri.",
    "Voi harmi, hyvä yritys oli mutta nyt kävi näin.",
    "Punasta korttiin ja matka kohti uusia pettymyksiä!",
    "PERSE! Tsemppiä nyt saatana!", "HYVÄ VADEE!", "Taso täällä taas ku MA6.",
    "NYT JUMALAUTA, VÄHÄN EES TSEMPPIÄ!", "Haha, emmä tienny et tää on näin paska!",
    "No nyt oli kyllä paskaa tuuria!",
    "Kävipä hyvä tuuri, ois voinu olla nimittäi VIELÄ PASKEMPAA!!",
    "Nyt on kyl taas TUOMIOPÄIVÄ,  ON TUOMIOPÄIVÄ, on KEINOSEN NIMIPÄIVÄ!",
  ],
  neutral: [
    "Onpahan tylsää...", "Nyt kun olisi aika hyökätä, niin mitä hän tekee?",
    "Ei tälläsellä pelillä kyllä mitaleille mennä :X", "Noniin, lisää harmaataa korttiin!",
    "On se ihannetuloskin tulos, kun", "buuuu!", "Ja ei taaskaa mitään yritystä.",
    "Parasta annettiin ja paskaa tehtiin.",
    "Jahas, yhtä surullista tekemistä ku asuminen Vantaalla.",
    "Hienosti! Vaikea väylä, mutta kyllä kelpaa.", "Mitähän tähän sit taas sanois?",
    "Ei huono!", "Joopajoooooo...", "Yrittäisit edes.",
    "Ei tällä paljoa fieldille hävitä!",
    "Noh aika harvat tällä väylällä paremmin heittää.",
    "Tämmösellä väylällä näin paskaa, on kyl surullista.",
    "Melkeen ymmärtäisin, jos ois ees vaikee väylä.",
    "Noh, ehkä seuraavalla väylällä sitten paremmin...",
  ],
};

export const verbs = [
  "otti", "sai", "suoritti", "taisteli", "möyri", "heitti", "viskoi",
  "rämisteli", "scrambläsi", "liidätteli", "paiskasi", "nakkeli",
  "sinkosi", "nosti", "lapioi", "viimeisteli",
];

export const obPhrases = [
  ", oli muuten myös <b>OBOBOB</b>",
  ", eikä pysyny ees väylällä <b>(ob)</b>",
  ", kaiken lisäks <b>OUT OF BOUNDS</b>",
  ", oli muute viel <b>OB</b> HÄHÄHÄHÄHÄ",
];

export const placeChangeTexts = {
  upOne:    ", kipusi sijan ylös",
  upMany:   ", nousi <n> sijaa",
  downOne:  ", putosi sijan",
  downMany: ", putosi <n> sijaa",
};

export const leaderGapTexts = {
  leads:         " – ja JOHTAA KISAA!",
  tiedForLead:   " – tasatilanteessa johdossa!",
  levelWithLead: " – tasatilanteessa johdosta!",
  closeBehind:   " – vain <n> takana johtajasta",
};

export const throws = [
  "fisbeegolfheitolla", "heitolla", "roiskasulla", "hyppyputilla", "tempaisulla",
];

export const descriptions = [
  " Iha siilon yli ja sit suoraan kuoppaan, perkele!", "Mörrin kautta järveen HAHAHAA",
  "WHAT THE FUCK RICHARD?????", "Varmasti vuoden kaunein draivi!", "Avas saatana taaksepäin xDDDD",
  "Bossiki kippas tohon vastaseen", "Keskellä lätäkköä, toivottavasti on sukelluskamat messissä",
  "Satavarma lost disci",
];
