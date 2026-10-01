import { describe, it, expect } from "vitest";
import { MetrixPlayerResult, TrackedPlayer } from "../../../types/metrix";
import { formatTopList } from "./topList";

// A competition's Results contain every division at once, and Metrix numbers positions
// within a division, so there is one OrderNumber === 1 per division.

function player(name: string, className: string, orderNumber: number, diff: number): MetrixPlayerResult {
  return { Name: name, ClassName: className, OrderNumber: orderNumber, Diff: diff, Sum: 54 + diff };
}

describe("formatTopList", () => {
  it("labels the division of tracked players listed outside the top five", () => {
    const results = [
      ...[1, 2, 3, 4, 5, 6].map(n => player(`MPO${n}`, "MPO", n, n)),
      ...[1, 2, 3, 4, 5, 6].map(n => player(`MA3_${n}`, "MA3", n, n + 10)),
    ];
    const tracked: TrackedPlayer[] = [
      { ...player("MPO6", "MPO", 6, 6), id: 1 },
      { ...player("MA3_6", "MA3", 6, 16), id: 2 },
    ];

    const message = formatTopList("Tiistaikisa", results, tracked);

    // Both sit at "6." - without the division label the section reads as a
    // single ranking in which two different people share sixth place.
    const others = message.split("Sarja Muut Sankarit")[1];
    expect(others).toContain("MPO6 (MPO)");
    expect(others).toContain("MA3_6 (MA3)");
  });
});
