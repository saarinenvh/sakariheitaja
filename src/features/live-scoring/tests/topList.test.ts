import { describe, it, expect } from "vitest";
import { RankedResult } from "../../../integrations/metrix/round/results";
import { formatTopList } from "../topList";

// A competition's Results contain every division at once, and Metrix numbers positions
// within a division, so there is one OrderNumber === 1 per division.

function player(name: string, division: string, position: number, relativeToPar: number): RankedResult {
  return { playerName: name, division, position, relativeToPar, strokes: 54 + relativeToPar };
}

describe("formatTopList", () => {
  it("labels the division of tracked players listed outside the top five", () => {
    const results = [
      ...[1, 2, 3, 4, 5, 6].map(n => player(`MPO${n}`, "MPO", n, n)),
      ...[1, 2, 3, 4, 5, 6].map(n => player(`MA3_${n}`, "MA3", n, n + 10)),
    ];
    const tracked = [player("MPO6", "MPO", 6, 6), player("MA3_6", "MA3", 6, 16)];

    const message = formatTopList("Tiistaikisa", results, tracked, new Map());

    // Both sit at "6." - without the division label the section reads as a
    // single ranking in which two different people share sixth place.
    const others = message.split("Sarja Muut Sankarit")[1];
    expect(others).toContain("MPO6 (MPO)");
    expect(others).toContain("MA3_6 (MA3)");
  });

  it("shows the rating after the score for finished rounds only", () => {
    const results = [player("Ville", "MA3", 1, -5), player("Tommi", "MA3", 2, 3)];

    const message = formatTopList("Tiistaikisa", results, [], new Map([["Ville", 962]]));

    expect(message).toContain("1. Ville\t\t\t\t-5 (rating 962)\n");
    expect(message).toContain("2. Tommi\t\t\t\t3\n");
  });
});
