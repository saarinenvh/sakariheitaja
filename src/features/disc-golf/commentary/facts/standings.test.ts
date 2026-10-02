import { describe, expect, it } from "vitest";
import { buildDivisionStandings } from "./standings";
import { parseMetrixRound } from "../../../../integrations/metrix/round/normalize";

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

describe("division standings", () => {
  it("lists the division's players with the gap to the leader, leaving other divisions out", () => {
    const standings = buildDivisionStandings(round(), "");
    expect(standings.map(standing => [standing.playerName, standing.position, standing.roundRelativeToPar, standing.leaderGap])).toEqual([
      ["Leader", 1, -1, { kind: "leader" }],
      ["Player", 2, 1, { kind: "behind", strokes: 2 }],
    ]);
  });

  it("does not compare different holes, missing scores, DNF or provisional standings", () => {
    for (const replacement of [
      { scorecard: { kind: "available" as const, holes: [null, { strokes: 2, relativeToPar: -1, obCount: 0 }] } },
      { scorecard: { kind: "unavailable" as const } },
      { round: { totalHoles: 2, status: "dnf" as const } },
      { standing: { position: 1, fieldSize: 2, isProvisional: true } },
    ]) {
      const snapshot = round();
      const changed = { ...snapshot, players: [{ ...snapshot.players[0], ...replacement }, ...snapshot.players.slice(1)] };
      const player = buildDivisionStandings(changed, "").find(standing => standing.playerName === "Player");
      expect(player?.leaderGap.kind).not.toBe("behind");
    }
  });

  it("reports tied leaders as both leading rather than one behind the other", () => {
    const snapshot = round();
    const tied = { ...snapshot, players: [snapshot.players[0], { ...snapshot.players[1], scorecard: snapshot.players[0].scorecard, standing: snapshot.players[0].standing }] };
    expect(buildDivisionStandings(tied, "").map(standing => standing.leaderGap)).toEqual([{ kind: "leader" }, { kind: "leader" }]);
  });

  it("orders division standings by place with unplaced players last, whatever the source order", () => {
    const shuffled = parseMetrixRound({ Competition: {
      ID: 123, Name: "Training", Date: "2026-09-28", CourseName: "Test", HasSubcompetitions: 0,
      Tracks: [1, 2].map(Number => ({ Number, Par: 3 })),
      Results: [
        { Name: "Not started", OrderNumber: null, PlayerResults: [[], []] },
        { Name: "Third", OrderNumber: 0, PlayerResults: [{ Result: 4, Diff: 1, PEN: 0 }, []] },
        { Name: "Leader", OrderNumber: 0, PlayerResults: [{ Result: 2, Diff: -1, PEN: 0 }, []] },
        { Name: "Second", OrderNumber: 0, PlayerResults: [{ Result: 3, Diff: 0, PEN: 0 }, []] },
      ],
    } }, "123");
    expect(buildDivisionStandings(shuffled, "").map(standing => [standing.playerName, standing.position]))
      .toEqual([["Leader", 1], ["Second", 2], ["Third", 3], ["Not started", null]]);
  });
});
