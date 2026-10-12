import { describe, expect, it } from "vitest";
import { buildGreetingFacts } from "../facts";
import { buildGamePlan } from "../../../tests/fixtures/gamePlans";
import { buildCityWeather } from "../../../tests/fixtures/weather";

const mood = "JALLU! JALLU! JALLU!\n";
const weather = buildCityWeather();

describe("buildGreetingFacts", () => {
  it("gives the weekday and date in Helsinki, the mood line, the weather and today's player counts", () => {
    const facts = buildGreetingFacts({
      now: new Date("2026-10-10T06:00:00Z"), mood, weather,
      todaysPlans: [buildGamePlan({}, ["Ville", "Wiltzu", "Matti", "Jori"]), buildGamePlan({ id: 13 }, ["Sami", "Jallu"])],
    });

    expect(facts).toEqual({
      weekday: "lauantai", date: "2026-10-10", mood: "JALLU! JALLU! JALLU!",
      weather: { town: "Helsinki", temperatureC: 9, windMs: 3, description: "pilvistä" },
      todaysGames: [{ players: 4 }, { players: 2 }],
    });
  });

  it("uses Helsinki's day just after midnight, while it's still the day before in UTC", () => {
    const facts = buildGreetingFacts({ now: new Date("2026-10-10T21:30:00Z"), mood, weather: null, todaysPlans: [] });

    expect(facts).toMatchObject({ weekday: "sunnuntai", date: "2026-10-11", weather: null, todaysGames: [] });
  });
});
