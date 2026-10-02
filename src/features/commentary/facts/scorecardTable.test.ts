import { describe, expect, it } from "vitest";
import { HoleScore } from "../../../integrations/metrix/round/types";
import { isPlayOrderKnown } from "./leadHistory";
import { RoundPlayer } from "../../../integrations/metrix/round/types";
import { buildScorecardTable } from "./scorecardTable";

const HOLE_LABELS = ["1", "2", "3", "4"];
const PAR = 3;

function hole(relativeToPar: number, obCount = 0): HoleScore {
  return { strokes: PAR + relativeToPar, relativeToPar, obCount };
}

function player(name: string, holes: readonly (HoleScore | null)[], overrides: Partial<RoundPlayer> = {}): RoundPlayer {
  return {
    sourceId: null, name, division: "MA3", group: "1",
    scorecard: { kind: "available", holes },
    round: { totalHoles: HOLE_LABELS.length, status: "active" },
    standing: { position: null, fieldSize: null, isProvisional: false },
    totalStrokes: null, totalRelativeToPar: null,
    ...overrides,
  };
}

const firstName = (fullName: string): string => fullName.split(" ")[0];

describe("scorecard table", () => {
  it("lists every recorded hole with result names, OB counts and marks for this update", () => {
    const ville = player("Ville Saarinen", [hole(0), hole(1, 1), hole(-1), null]);
    const tommi = player("Tommi Virtanen", [hole(-1), hole(0), null, null]);
    const table = buildScorecardTable({
      holeLabels: HOLE_LABELS, players: [ville, tommi], displayName: firstName,
      newHoles: new Map([["Ville Saarinen", new Set([3])]]),
    });
    expect(table).toBe([
      "Väylä | Par | Ville | Tommi",
      "1 | 3 | par | birdie",
      "2 | 3 | bogi (1 OB) | par",
      "3 | 3 | birdie* | -",
    ].join("\n"));
  });

  it("returns null when nobody has recorded a hole or no scorecard is available", () => {
    const empty = player("Ville", [null, null, null, null]);
    const unavailable = player("Tommi", [], { scorecard: { kind: "unavailable" } });
    expect(buildScorecardTable({ holeLabels: HOLE_LABELS, players: [empty, unavailable], newHoles: new Map(), displayName: firstName }))
      .toBeNull();
  });
});

describe("play order", () => {
  it("is known when every active player has recorded holes from the first hole without gaps", () => {
    const ahead = player("Ville", [hole(0), hole(0), hole(0), null]);
    const behind = player("Tommi", [hole(0), null, null, null]);
    const retired = player("Teppo", [null, hole(0), null, null], { round: { totalHoles: 4, status: "dnf" } });
    expect(isPlayOrderKnown([ahead, behind, retired])).toBe(true);
  });

  it("is unknown when a player started from a later hole", () => {
    const shotgun = player("Ville", [null, null, hole(0), hole(0)]);
    expect(isPlayOrderKnown([shotgun, player("Tommi", [hole(0), null, null, null])])).toBe(false);
  });
});
