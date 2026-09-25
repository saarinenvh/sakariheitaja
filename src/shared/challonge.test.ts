import { describe, it, expect } from "vitest";
import { findParticipantByName, findParticipantsByName, findPlayerMatch, formatFullBracket, type BracketData } from "./challonge";

// Small, hand-built double-elimination-shaped bracket - four players, one
// completed match, one open (current), one not yet started, mirroring the
// shape a real Challonge tournament returns without needing live data.
// Two Villes on purpose - a real case in this club ("Ville Saarinen" and
// "Ville Liedes") that makes a bare "Ville" genuinely ambiguous.
const TURKKA = { id: 1, name: "Turkka Maisala" };
const VILLE = { id: 2, name: "Ville Saarinen" };
const TOPI = { id: 3, name: "Topi Stenman" };
const JORI = { id: 4, name: "Jori Nurminen" };
const VILLE_L = { id: 5, name: "Ville Liedes" };

const bracket: BracketData = {
  tournamentName: "Match Play 2026",
  participants: [TURKKA, VILLE, TOPI, JORI, VILLE_L],
  matches: [
    // Round 1, winners bracket: Turkka beat Topi already.
    { round: 1, player1Id: TURKKA.id, player2Id: TOPI.id, winnerId: TURKKA.id, state: "complete", scoresCsv: "13-8" },
    // Round 2: Turkka's next match is open, opponent already known (Ville).
    { round: 2, player1Id: TURKKA.id, player2Id: VILLE.id, winnerId: null, state: "open", scoresCsv: null },
    // Round 2, the other bracket half: not started, opponent not yet decided.
    { round: 2, player1Id: JORI.id, player2Id: null, winnerId: null, state: "pending", scoresCsv: null },
  ],
};

describe("findParticipantByName", () => {
  it("matches the full name, case-insensitively", () => {
    expect(findParticipantByName(bracket, "turkka maisala")).toEqual(TURKKA);
  });

  it("matches a bare first name", () => {
    // Telegram sender names and spoken/typed mentions are almost always just
    // "Turkka", never the full "Turkka Maisala".
    expect(findParticipantByName(bracket, "Turkka")).toEqual(TURKKA);
  });

  it("returns null for someone not in the bracket", () => {
    expect(findParticipantByName(bracket, "Sakke")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(findParticipantByName(bracket, "")).toBeNull();
    expect(findParticipantByName(bracket, "   ")).toBeNull();
  });

  it("returns null (not a guess) for a first name shared by two players", () => {
    expect(findParticipantByName(bracket, "Ville")).toBeNull();
  });
});

describe("findParticipantsByName", () => {
  it("returns both players for a bare first name they share", () => {
    const matches = findParticipantsByName(bracket, "Ville");
    expect(matches).toHaveLength(2);
    expect(matches).toEqual(expect.arrayContaining([VILLE, VILLE_L]));
  });

  it("an exact full-name match is never ambiguous, even though a shorter query would be", () => {
    // "Ville Saarinen" typed in full always means that Ville Saarinen, even
    // though the bare "Ville" it starts with also matches Ville Liedes.
    expect(findParticipantsByName(bracket, "Ville Saarinen")).toEqual([VILLE]);
    expect(findParticipantsByName(bracket, "ville liedes")).toEqual([VILLE_L]);
  });
});

describe("findPlayerMatch", () => {
  it("finds the current open match and names the known opponent", () => {
    const result = findPlayerMatch(bracket, TURKKA.id);
    expect(result).toContain("Turkka Maisala");
    expect(result).toContain("Ville Saarinen");
    expect(result).not.toContain("TBD");
  });

  it("skips a completed match to find the actually-current one", () => {
    // Turkka has both a complete round-1 match and an open round-2 one - the
    // real bug this project hit was answering with stale/wrong-round info,
    // so this is the one assertion that most directly guards against it.
    const result = findPlayerMatch(bracket, TURKKA.id);
    expect(result).not.toContain("Topi");
  });

  it("says the opponent isn't known yet rather than writing TBD into the answer", () => {
    const result = findPlayerMatch(bracket, JORI.id);
    expect(result).toContain("Jori Nurminen");
    expect(result).toContain("ei vielä tiedossa");
    expect(result).not.toMatch(/\bTBD\b/);
  });

  it("returns null for a player with no matches in the bracket at all", () => {
    expect(findPlayerMatch(bracket, 999)).toBeNull();
  });
});

describe("formatFullBracket", () => {
  it("includes every player and groups matches by round", () => {
    const text = formatFullBracket(bracket);
    expect(text).toContain("Turkka Maisala");
    expect(text).toContain("Ville Saarinen");
    expect(text).toContain("Topi Stenman");
    expect(text).toContain("Jori Nurminen");
    expect(text).toContain("Winners Round 1");
    expect(text).toContain("Winners Round 2");
  });

  it("marks the completed match with its winner and score", () => {
    const text = formatFullBracket(bracket);
    expect(text).toContain("Winner: Turkka Maisala (13-8)");
  });

  it("marks the open match as the current one", () => {
    const text = formatFullBracket(bracket);
    expect(text).toMatch(/Turkka Maisala vs Ville Saarinen ← CURRENT MATCH/);
  });
});
