import { describe, expect, it } from "vitest";
import { CheckId, opening, runChecks } from "../checks";
import { selectScenarios } from "../scenarios";
import { GreetingFacts } from "../../../src/features/morning-greeting/facts";

const rainyNoGames: GreetingFacts = {
  weekday: "maanantai", date: "2026-10-12",
  weather: { town: "Jyväskylä", temperatureC: 3, windMs: 6, description: "kevyttä sadetta" }, todaysGames: [],
  recentGreetings: [],
};
const twoGames: GreetingFacts = { ...rainyNoGames, todaysGames: [{ players: 4 }, { players: 2 }] };

/** The checks on `text` as Sakke's greeting: its first sentence is the greeting part, the rest the games part. */
function checksOf(text: string, facts: GreetingFacts = rainyNoGames): CheckId[] {
  const [greeting, ...rest] = text.split(/(?<=[.!?])\s+/u);
  const reply = { greeting, weather: null, games: rest.join(" "), gifQuery: "rain" as const, text };
  return runChecks(facts, { kind: "generated", reply }).map(finding => finding.check);
}

describe("greeting checks", () => {
  it("passes a greeting that opens right and keeps to the facts", () => {
    expect(checksOf("Hyvää huomenta sankarit! Jyväskylässä sataa, eli maanantai alkaa ansaitusti. Kaks porukkaa ja kuusi pelaajaa on jo tulossa.", twoGames))
      .toEqual([]);
  });

  it("fails a fallback with its reason", () => {
    expect(runChecks(rainyNoGames, { kind: "fallback", reason: "unusable-response" }))
      .toEqual([{ check: "fallback", severity: "fail", detail: "unusable-response" }]);
  });

  it.each(["Huomenta.", "HYVÄÄ HUOMENTA SANKARIT!", "Aamuja porukka.", "Herätys, sankarit!", "Nyt on se aamu, kun ei jaksa."])(
    "accepts %s as a morning greeting", greeting => {
      expect(checksOf(`${greeting} Jyväskylässä sataa. Tänään ei pelata.`)).not.toContain("no-greeting");
    },
  );

  it.each(["Jyväskylässä sataa kevyttä vettä.", "Huomenna sataa taas.", "Sataa. Huomenta muille."])(
    "fails %s as not a greeting", start => {
      expect(checksOf(`${start} Tänään ei oo pelejä.`)).toContain("no-greeting");
    },
  );

  it("fails clock times but not a date", () => {
    expect(checksOf("Huomenta. Peli alkaa klo 18. Tulkaa.")).toContain("clock-time");
    expect(checksOf("Huomenta. Peli alkaa 18.00 Keljossa. Tulkaa.")).toContain("clock-time");
    expect(checksOf("Huomenta. Tulkaa. Peli alkaa 18.00.")).toContain("clock-time");
    expect(checksOf("Huomenta. Tänään on 12.10. ja sataa. Tulkaa.")).not.toContain("clock-time");
  });

  it("fails letters from another script, as in q3's glitch", () => {
    expect(checksOf("Aamua. J나uväskylässä sataa kevyesti. Ei pelejä.")).toContain("foreign-script");
  });

  it("warns about letters Finnish doesn't use and about balls, as in q3's glitches", () => {
    expect(checksOf("Aamua sankarit. Vantaalla on selkeetät kéli. Kolme tulossa.")).toContain("odd-letter");
    expect(checksOf("Hyvää huomenta! Ainakin pallo näkyy. Tulkaa.")).toContain("ball-word");
    expect(checksOf("Huomenta. Kiekko lentää ja ketju kilisee korissa. Tulkaa.")).toEqual([]);
  });

  it("warns about the weather as numbers, which the card gives", () => {
    expect(checksOf("Huomenta. Jyväskylässä +3 astetta ja sataa. Ei pelejä.")).toContain("weather-numbers");
    expect(checksOf("Huomenta. Tuulee 6 m/s. Ei pelejä.")).toContain("weather-numbers");
    expect(checksOf("Huomenta. Kuopiossa -1 asteen pakkanen. Ei pelejä.")).toContain("weather-numbers");
    expect(checksOf("Huomenta. Tuulee yhdeksän metriä sekunnissa. Ei pelejä.")).toContain("weather-numbers");
    expect(checksOf("Huomenta. Turussa +26 ja tyyntä. Ei pelejä.")).toContain("weather-numbers");
    expect(checksOf("Huomenta. Jyväskylässä sataa vaakatasossa. Ei pelejä.")).not.toContain("weather-numbers");
  });

  it("warns about a word loop, but not the group's own pelejäpelejä", () => {
    expect(checksOf("Huomenta. Kuusi on valmiina kotiin kotiin kotiin peliä. Tulkaa.", twoGames)).toContain("repeated-word");
    expect(checksOf("Huomenta. Oisko jo pelejäpelejäpelejä? Tulkaa.")).not.toContain("repeated-word");
  });

  it("warns about cancelled games or sign-ups on a day with none", () => {
    expect(checksOf("Huomenta porukka. Pelit on peruttu. Jatkakaa vaan.")).toContain("invented-games");
    expect(checksOf("Huomenta porukka. Pelit on peruttu. Jatkakaa vaan.", twoGames)).not.toContain("invented-games");
  });

  it("warns about counts of games or players that aren't in the facts", () => {
    expect(checksOf("Huomenta. Seitsemän pelaajaa on tulossa. Hyvä.", twoGames)).toContain("wrong-count");
    expect(checksOf("Huomenta. Kolme sankaria on lähdössä. Hyvä.")).toContain("wrong-count");
    expect(checksOf("Huomenta. Kaks peliä ja 4 pelaajaa toisessa. Hyvä.", twoGames)).not.toContain("wrong-count");
    expect(checksOf("Huomenta. Kuusi peliä tänään. Hyvä.", twoGames)).toContain("wrong-count");
    expect(checksOf("Huomenta. Kaks pelaajaa vaan. Hyvä.", { ...rainyNoGames, todaysGames: [{ players: 5 }, { players: 3 }] }))
      .toContain("wrong-count");
  });

  it("warns about too few or too many sentences, emojis and hashtags", () => {
    expect(checksOf("Huomenta vaan.")).toContain("sentence-count");
    expect(checksOf("Huomenta. Yks. Kaks. Kolme. Neljä. Viis.")).toContain("sentence-count");
    expect(checksOf("Huomenta ☀️ Sataa. Ei pelejä.")).toContain("emoji-or-hashtag");
    expect(checksOf("Huomenta. Sataa #frisbeegolf. Ei pelejä.")).toContain("emoji-or-hashtag");
  });
});

describe("checks against the recent greetings", () => {
  const afterYesterday: GreetingFacts = {
    ...rainyNoGames,
    recentGreetings: ["Huomenta porukka. Tänään ei oo sovittu yhtään peliä, joten voitte vaan istua talissa."],
  };

  it("warns about the same opening and a copied phrase", () => {
    expect(checksOf("Huomenta porukka! Sataa, joten voitte vaan istua talissa ja kattoa seinää.", afterYesterday))
      .toEqual(["repeats-opening", "copies-recent"]);
  });

  it("lets a new opening and a few shared everyday words through", () => {
    expect(checksOf("Aamuja, sankarit! Jyväskylässä sataa. Tänään ei oo sovittu mitään, eli sohva kutsuu.", afterYesterday))
      .toEqual([]);
  });
});

describe("opening", () => {
  it("takes up to two words before the first punctuation, lowercased", () => {
    expect(opening("HYVÄÄ HUOMENTA SANKARIT! Kuopiossa sataa.")).toBe("hyvää huomenta");
    expect(opening("Aamua. Jallu oli taas loistoidea.")).toBe("aamua");
    expect(opening("Huomenta porukka, Vantaalla on selkeää.")).toBe("huomenta porukka");
  });
});

describe("scenario selection", () => {
  it("gives all scenarios by default, the named ones, or an error for an unknown name", () => {
    expect(selectScenarios([]).length).toBeGreaterThan(1);
    expect(selectScenarios(["friday-no-weather"]).map(scenario => scenario.name)).toEqual(["friday-no-weather"]);
    expect(() => selectScenarios(["nope"])).toThrow("Unknown scenario nope");
  });
});
