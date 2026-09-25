import { describe, it, expect } from "vitest";
import { isMatchPlayQuestion, isOpponentQuestion, resolveTargetPlayer } from "./llmAsker";
import type { BracketData } from "../shared/challonge";

// The actual messages from the live conversation that exposed this bug -
// none of these mention match play at all, so isMatchPlayQuestion has to say
// no to all of them, or matchplay_context.md's bracket-heavy framing loads
// back into every question's system prompt and the hallucination returns.
describe("isMatchPlayQuestion", () => {
  it("says no to ordinary chat that just happens to mention Sakke", () => {
    expect(isMatchPlayQuestion("Taasko se alko sakkee kiusaamaa")).toBe(false);
    expect(isMatchPlayQuestion("Kiitos sakke, sitä ei toki kysytty")).toBe(false);
    expect(isMatchPlayQuestion("Jes! Koskas mennää sakke pelaamaa?")).toBe(false);
    expect(isMatchPlayQuestion("No pitkää joutuu odottamaa peliä Turkka vs sakke")).toBe(false);
    expect(isMatchPlayQuestion("Sakke pelataanko vaikka ensi viikolla vastakkain?")).toBe(false);
  });

  it("says yes to an actual match-play question", () => {
    expect(isMatchPlayQuestion("Sakke, anna linkki reikäpelikaavioon")).toBe(true);
    expect(isMatchPlayQuestion("Kuka on vastustajani seuraavaksi?")).toBe(true);
    expect(isMatchPlayQuestion("Onko Turkka jo eliminoitu?")).toBe(true);
  });
});

describe("isOpponentQuestion", () => {
  it("is true for a 'who do I play next' style question", () => {
    expect(isOpponentQuestion("ketä vastaan minulla on seuraava peli")).toBe(true);
    expect(isOpponentQuestion("kuka on vastustajani")).toBe(true);
  });

  it("is false for a bracket-link request, which needs the full context and the static URL, not one match", () => {
    expect(isOpponentQuestion("Sakke, anna linkki reikäpelikaavioon")).toBe(false);
  });

  it("is false for a broad 'who's still in' style question", () => {
    expect(isOpponentQuestion("ketkä on vielä mukana turnauksessa")).toBe(false);
  });
});

const TURKKA = { id: 1, name: "Turkka Maisala" };
const VILLE = { id: 2, name: "Ville Saarinen" };
const VILLE_L = { id: 3, name: "Ville Liedes" };

const bracket: BracketData = {
  tournamentName: "Match Play 2026",
  participants: [TURKKA, VILLE, VILLE_L],
  matches: [],
};

describe("resolveTargetPlayer", () => {
  it("resolves a name mentioned in the question over the sender's own name", () => {
    // matchplay_context.md's own rule: "ketä vastaan Turkka pelaa seuraavaksi"
    // means find Turkka, not whoever asked. Nominative form deliberately -
    // see the note below on inflected forms.
    const result = resolveTargetPlayer(bracket, "ketä vastaan Turkka pelaa seuraavaksi", "Ville Saarinen");
    expect(result).toEqual(TURKKA);
  });

  it("does not match an inflected form of a name - a known, real limitation", () => {
    // Finnish consonant gradation: "Turkalla" (adessive, "at Turkka's") isn't
    // even a prefix of "Turkka" - kk gradates to k under the -lla suffix.
    // Plain substring/word matching cannot handle this; a real fix would need
    // a Finnish stemmer or fuzzy matching, out of scope for this pass. This
    // test exists so a future attempt at fixing it has something to turn
    // green, not to claim the gap doesn't exist.
    expect(resolveTargetPlayer(bracket, "ketä vastaan Turkalla on seuraava peli", undefined)).toBeNull();
  });

  it("falls back to the sender's own name when the question names nobody", () => {
    const result = resolveTargetPlayer(bracket, "ketä vastaan mulla on seuraava peli", "Turkka Maisala");
    expect(result).toEqual(TURKKA);
  });

  it("does not guess when a bare name in the question is ambiguous and there is no sender to fall back to", () => {
    const result = resolveTargetPlayer(bracket, "milloin Ville pelaa seuraavaksi", undefined);
    expect(result).toBeNull();
  });

  it("still falls back to the sender's own name when the question's name is ambiguous but the sender isn't", () => {
    // "Ville" alone can't be resolved from the question (two players share
    // it), but that doesn't mean give up entirely - the sender asking is
    // themselves unambiguous, so use them rather than the vague mention.
    const result = resolveTargetPlayer(bracket, "milloin Ville pelaa seuraavaksi", "Turkka Maisala");
    expect(result).toEqual(TURKKA);
  });

  it("a later word (the last name) disambiguates an otherwise-ambiguous first name", () => {
    const result = resolveTargetPlayer(bracket, "milloin Ville Saarinen pelaa seuraavaksi", "Turkka Maisala");
    expect(result).toEqual(VILLE);
  });

  it("returns null rather than guessing when nobody in the question or sender name resolves", () => {
    expect(resolveTargetPlayer(bracket, "ketä vastaan pelataan", undefined)).toBeNull();
  });
});
