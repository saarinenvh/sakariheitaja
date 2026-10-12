import type { GreetingFacts } from "../../src/features/morning-greeting/facts";

/** A morning to greet: the facts exactly as the model gets them, under a short name for the report. */
export interface GreetingScenario {
  name: string;
  facts: GreetingFacts;
}

/** Days that pull the prompt different ways: rain or sun, no games or many, and no weather at all. */
export const scenarios: readonly GreetingScenario[] = [
  {
    name: "rainy-monday-no-games",
    facts: {
      weekday: "maanantai", date: "2026-10-12",
      weather: { town: "Jyväskylä", temperatureC: 3, windMs: 6, description: "kevyttä sadetta" },
      todaysGames: [],
    },
  },
  {
    name: "clear-wednesday-one-game",
    facts: {
      weekday: "keskiviikko", date: "2026-10-14",
      weather: { town: "Vantaa", temperatureC: 11, windMs: 2, description: "selkeää" },
      todaysGames: [{ players: 3 }],
    },
  },
  {
    name: "snowy-saturday-two-games",
    facts: {
      weekday: "lauantai", date: "2026-10-17",
      weather: { town: "Kuopio", temperatureC: -1, windMs: 11, description: "lumisadetta" },
      todaysGames: [{ players: 4 }, { players: 2 }],
    },
  },
  {
    name: "friday-no-weather",
    facts: { weekday: "perjantai", date: "2026-10-16", weather: null, todaysGames: [{ players: 5 }] },
  },
  {
    name: "hot-sunday-three-games",
    facts: {
      weekday: "sunnuntai", date: "2026-07-12",
      weather: { town: "Turku", temperatureC: 26, windMs: 1, description: "taivas on selkeä" },
      todaysGames: [{ players: 6 }, { players: 4 }, { players: 3 }],
    },
  },
  {
    name: "windy-tuesday-no-games",
    facts: {
      weekday: "tiistai", date: "2026-10-13",
      weather: { town: "Oulu", temperatureC: 7, windMs: 14, description: "hajanaisia pilviä" },
      todaysGames: [],
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
