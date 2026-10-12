import type { GreetingFacts } from "../../src/features/morning-greeting/facts";

/** A morning to greet: the facts exactly as the model gets them, under a short name for the report. */
export interface GreetingScenario {
  name: string;
  facts: GreetingFacts;
}

/**
 * Five greetings q4 wrote on 2026-10-12 before it saw any history, newest first: four open with
 * "Huomenta porukka", the production complaint, and they share jokes (talissa, jallu, virheet).
 */
const SAMEY_WEEK = [
  "Huomenta porukka. Oulussa on hajanaiset pilvet ja tuulee niin että kämmenet jäätyy, eli tänään on täydellinen päivä olla talessa ja välttää radat. Tänään ei oo sovittu yhtään peliä, joten voitte vaan istua siellä ja katsella seinää.",
  "HYVÄÄ HUOMENTA SANKARIT! Turussa on taivas ihan selkeä, eli kukaan ei voi syyttää pilviä tai sumua huonoista heitoista tänään. Kolme eri porukkaa on jo lähdössä radalle, joten tulkaa mukaan ennen kuin joku muu vie kaikki hyvät pelihetket.",
  "Huomenta porukka. Perjantai on täällä, eli on aika pohtia, ootteko tänään talissa vai lähdettekö taas hinkkaamaan niitä samoja huonoja heittoja. Viisi pelaajaa on jo ilmoittautunu päivän peliin, eli tilaa on vielä niillekin jotka uskaltaa tulla.",
  "Huomenta porukka. Vantaalla on selkeää, eli ainakaan mikään ei jää epäselväksi, paitsi se että kolme ihmistä on oikeasti päättänyt lähteä pelaamaan keskiviikkona. Toivottavasti se jallu ei vielä vaikuta teidän suuntaan.",
  "Huomenta porukka. Jyväskylässä sataa kevyttä vettä, eli aamun fiilis on vähän kuin hukkunut frisbee laatikon pohjalla. Tänään ei oo sovittu yhtään peliä, joten voitte vaan istua siellä talissa ja miettiä niitä omia virheitänne.",
];

/**
 * Days that pull the prompt different ways: rain or sun, no games or many, and no weather at all.
 * All but Friday (the first greeting, no history yet) follow the samey week, as production will.
 */
export const scenarios: readonly GreetingScenario[] = [
  {
    name: "rainy-monday-no-games",
    facts: {
      weekday: "maanantai", date: "2026-10-12",
      weather: { town: "Jyväskylä", temperatureC: 3, windMs: 6, description: "kevyttä sadetta" },
      todaysGames: [],
      recentGreetings: SAMEY_WEEK,
    },
  },
  {
    name: "clear-wednesday-one-game",
    facts: {
      weekday: "keskiviikko", date: "2026-10-14",
      weather: { town: "Vantaa", temperatureC: 11, windMs: 2, description: "selkeää" },
      todaysGames: [{ players: 3 }],
      recentGreetings: SAMEY_WEEK,
    },
  },
  {
    name: "snowy-saturday-two-games",
    facts: {
      weekday: "lauantai", date: "2026-10-17",
      weather: { town: "Kuopio", temperatureC: -1, windMs: 11, description: "lumisadetta" },
      todaysGames: [{ players: 4 }, { players: 2 }],
      recentGreetings: SAMEY_WEEK,
    },
  },
  {
    name: "friday-no-weather",
    facts: { weekday: "perjantai", date: "2026-10-16", weather: null, todaysGames: [{ players: 5 }], recentGreetings: [] },
  },
  {
    name: "hot-sunday-three-games",
    facts: {
      weekday: "sunnuntai", date: "2026-07-12",
      weather: { town: "Turku", temperatureC: 26, windMs: 1, description: "taivas on selkeä" },
      todaysGames: [{ players: 6 }, { players: 4 }, { players: 3 }],
      recentGreetings: SAMEY_WEEK,
    },
  },
  {
    name: "windy-tuesday-no-games",
    facts: {
      weekday: "tiistai", date: "2026-10-13",
      weather: { town: "Oulu", temperatureC: 7, windMs: 14, description: "hajanaisia pilviä" },
      todaysGames: [],
      recentGreetings: SAMEY_WEEK,
    },
  },
];

/** The scenarios named in `names`, or all of them when it's empty; an unknown name is an error. */
export function selectScenarios(names: readonly string[]): GreetingScenario[] {
  if (names.length === 0) return [...scenarios];

  const unknown = names.filter(name => !scenarios.some(scenario => scenario.name === name));
  if (unknown.length > 0) {
    throw new Error(`Unknown scenario ${unknown.join(", ")}; known: ${scenarios.map(scenario => scenario.name).join(", ")}`);
  }
  return scenarios.filter(scenario => names.includes(scenario.name));
}
