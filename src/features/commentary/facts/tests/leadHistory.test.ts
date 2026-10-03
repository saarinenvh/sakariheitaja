import { describe, expect, it } from "vitest";
import { HoleScore } from "../../../../integrations/metrix/round/types";
import { describeLeadHistory } from "../leadHistory";
import { RoundPlayer } from "../../../../integrations/metrix/round/types";

const TOTAL_HOLES = 18;
const PAR = 3;

function hole(relativeToPar: number | null): HoleScore {
  return { strokes: PAR + (relativeToPar ?? 0), relativeToPar, obCount: 0 };
}

function player(name: string, scores: readonly (number | null | undefined)[], overrides: Partial<RoundPlayer> = {}): RoundPlayer {
  const holes: (HoleScore | null)[] = Array.from({ length: TOTAL_HOLES }, () => null);
  scores.forEach((score, index) => {
    if (score !== undefined) holes[index] = hole(score);
  });
  return {
    sourceId: null, name, division: "MA3", group: "1",
    scorecard: { kind: "available", holes },
    round: { totalHoles: TOTAL_HOLES, status: "active" },
    standing: { position: null, fieldSize: null, isProvisional: true },
    totalStrokes: null, totalRelativeToPar: null,
    ...overrides,
  };
}

const firstName = (fullName: string): string => fullName.split(" ")[0];

describe("lead history", () => {
  it("counts lead changes, leaders and the current streak when two players trade the lead", () => {
    const ville = player("Ville Saarinen", [-1, 1, -1, 1, 0, 0]);
    const tommi = player("Tommi Virtanen", [0, -1, 0, 0, 0, 0]);
    // Cumulative: Ville -1,0,-1,0,0,0 / Tommi 0,-1,-1,-1,-1,-1
    expect(describeLeadHistory([ville, tommi], firstName)).toBe(
      "Johto on vaihtunut 3 kertaa 6 väylän aikana. Kärjessä ovat olleet Ville ja Tommi."
      + " Nyt johtaa Tommi. Sama kärki on pysynyt 3 väylää putkeen."
      + " Kärjen ero on ollut viimeisillä 6 väylällä enintään 1 heitto.",
    );
  });

  it("describes a wire-to-wire leader and only looks at the recent window for the gap", () => {
    const leader = player("Ville", [-5, 1, 0, 0, 0, 0, 0, 0]);
    const chaser = player("Tommi", [0, 0, 0, 0, 0, 0, 0, 0]);
    expect(describeLeadHistory([leader, chaser], firstName)).toBe(
      "Ville on johtanut kaikki 8 pelattua väylää. Kärjen ero on ollut viimeisillä 6 väylällä enintään 4 heittoa.",
    );
  });

  it("reports a current tie without naming a sole leader", () => {
    const ville = player("Ville", [-1, 0, 0]);
    const tommi = player("Tommi", [0, 0, -1]);
    const aki = player("Aki", [0, 0, 0]);
    expect(describeLeadHistory([ville, tommi, aki], firstName)).toBe(
      "Johto on vaihtunut kerran 3 väylän aikana. Kärjessä ovat olleet Ville ja Tommi."
      + " Nyt kärjessä tasatilanne: Ville ja Tommi. Kärki muuttui viimeisimmällä väylällä."
      + " Kärjen ero on ollut viimeisillä 3 väylällä enintään 1 heitto.",
    );
  });

  it("describes a lead shared from the start", () => {
    const ville = player("Ville", [0, 0]);
    const tommi = player("Tommi", [0, 0]);
    expect(describeLeadHistory([ville, tommi], firstName)).toBe(
      "Tommi ja Ville ovat jakaneet johdon kaikki 2 pelattua väylää. Kärki on ollut tasan viimeisillä 2 väylällä.",
    );
  });

  it("ignores DNF players and players without a scorecard", () => {
    const dnf = player("Quitter", [-5], { round: { totalHoles: TOTAL_HOLES, status: "dnf" } });
    const hidden = player("Hidden", [], { scorecard: { kind: "unavailable" } });
    const ville = player("Ville", [-1, 0]);
    const tommi = player("Tommi", [0, 0]);
    expect(describeLeadHistory([dnf, hidden, ville, tommi], firstName)).toBe(
      "Ville on johtanut kaikki 2 pelattua väylää. Kärjen ero on ollut viimeisillä 2 väylällä enintään 1 heitto.",
    );
  });

  it("makes no claim when play order is not known", () => {
    const ville = player("Ville", [0, 0, 0]);
    const unequalProgress = player("Tommi", [0, 0]);
    const shotgunStart = player("Tommi", [undefined, undefined, 0, 0, 0]);
    const gapInCard = player("Tommi", [0, undefined, 0]);
    for (const other of [unequalProgress, shotgunStart, gapInCard]) {
      expect(describeLeadHistory([ville, other], firstName)).toBeNull();
    }
  });

  it("makes no claim with too little data", () => {
    expect(describeLeadHistory([player("Ville", [0]), player("Tommi", [-1])], firstName)).toBeNull();
    expect(describeLeadHistory([player("Ville", [0, 0, 0])], firstName)).toBeNull();
    expect(describeLeadHistory([player("Ville", [0, null]), player("Tommi", [0, 0])], firstName)).toBeNull();
  });

  it("uses the display names given by the caller", () => {
    const history = describeLeadHistory(
      [player("Ville Saarinen", [-1, 0]), player("Tommi Virtanen", [0, 0])],
      fullName => fullName.toUpperCase(),
    );
    expect(history).toContain("VILLE SAARINEN on johtanut");
    expect(history).not.toContain("Ville");
  });
});
