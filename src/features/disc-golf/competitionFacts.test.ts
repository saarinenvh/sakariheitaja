import { describe, expect, it } from "vitest";
import { buildCompetitionFacts } from "./competitionFacts";
import { parseMetrixRound } from "./metrixRound";

function round() {
  return parseMetrixRound({ Competition: {
    ID: 123, Name: "Training", Date: "2026-09-28", CourseName: "Test", HasSubcompetitions: 0,
    Tracks: [1, 2].map(Number => ({ Number, Par: 3 })),
    Results: [
      { Name: "Leader", OrderNumber: 1, PlayerResults: [{ Result: 2, Diff: -1, PEN: 0 }, []] },
      { Name: "Player", OrderNumber: 2, PlayerResults: [{ Result: 4, Diff: 1, PEN: 0 }, []] },
      { Name: "Other division", ClassName: "MPO", OrderNumber: 1, PlayerResults: [{ Result: 1, Diff: -2 }, []] },
    ],
  } }, "123");
}

describe("current competition facts", () => {
  it("includes untracked division opponents with correctly directed gaps", () => {
    const snapshot = round();
    const facts = buildCompetitionFacts(snapshot, snapshot.players[1]);
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({ position: 1, roundRelativeToPar: -1, recordedHoles: 1 });
    expect(facts[0].comparisonToPlayer).toBe("2 heittoa edellä kommentoitavaa pelaajaa samoilla kirjatuilla väylillä.");
    expect(buildCompetitionFacts(snapshot, snapshot.players[0])[1].comparisonToPlayer).toContain("2 heittoa jäljessä");
  });

  it("does not compare different holes, missing scores, DNF or provisional standings", () => {
    for (const replacement of [
      { scorecard: { kind: "available" as const, holes: [null, { strokes: 2, relativeToPar: -1, obCount: 0 }] } },
      { scorecard: { kind: "unavailable" as const } },
      { round: { totalHoles: 2, status: "dnf" as const } },
      { standing: { position: 1, fieldSize: 2, isProvisional: true } },
    ]) {
      const snapshot = round();
      const changed = { ...snapshot, players: [{ ...snapshot.players[0], ...replacement }, snapshot.players[1]] };
      expect(buildCompetitionFacts(changed, changed.players[1])[0].comparisonToPlayer).toContain("ei verrata");
    }
  });

  it("reports ties without claiming a sole leader", () => {
    const snapshot = round();
    const tied = { ...snapshot, players: [snapshot.players[0], { ...snapshot.players[1], scorecard: snapshot.players[0].scorecard, standing: snapshot.players[0].standing }] };
    expect(buildCompetitionFacts(tied, tied.players[1])[0].comparisonToPlayer).toContain("Sama kirjattu yhteistulos");
  });
});
