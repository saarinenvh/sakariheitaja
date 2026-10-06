import { describe, expect, it } from "vitest";
import { parseMetrixRound } from "../normalize";
import { isSamePlayerName, trackRoundPlayers } from "../results";

function roundWith(names: string[]) {
  return parseMetrixRound({
    Competition: {
      ID: "123", Name: "Kierros", Date: "2026-10-03", CourseName: "Testirata",
      Tracks: [{ Number: "1", Par: "3" }],
      Results: names.map((Name, index) => ({ Name, ClassName: "MA3", OrderNumber: index + 1, PlayerResults: [[]] })),
    },
  }, "123");
}

describe("isSamePlayerName", () => {
  it("ignores case and surrounding space", () => {
    expect(isSamePlayerName("ville", "Ville")).toBe(true);
    expect(isSamePlayerName(" Ville Saarinen ", "VILLE SAARINEN")).toBe(true);
    expect(isSamePlayerName("Äijä", "äijä")).toBe(true);
  });

  it("still tells different names apart", () => {
    expect(isSamePlayerName("Ville", "Ville S")).toBe(false);
  });
});

describe("trackRoundPlayers", () => {
  it("tracks a player added in lower case under Metrix's capitalised name", () => {
    const tracked = trackRoundPlayers(roundWith(["Ville", "Jori"]), [{ id: 1, name: "ville" }]);

    expect(tracked.map(({ id, player }) => [id, player.name])).toEqual([[1, "Ville"]]);
  });

  it("skips a name that matches several round players, case aside", () => {
    expect(trackRoundPlayers(roundWith(["Ville", "VILLE"]), [{ id: 1, name: "ville" }])).toEqual([]);
  });

  it("skips a player who isn't in the round", () => {
    expect(trackRoundPlayers(roundWith(["Jori"]), [{ id: 1, name: "Ville" }])).toEqual([]);
  });
});
