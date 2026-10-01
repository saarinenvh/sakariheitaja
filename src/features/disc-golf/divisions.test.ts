import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";

// Regression tests for the division bug: a competition's Results contain every
// division at once, and Metrix numbers positions WITHIN a division - so there
// is one OrderNumber === 1 per division. Anything that treated Results as a
// single ranking silently mixed divisions together.

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "sakke-profiles-"));

let formatTopList: typeof import("./commentary").formatTopList;
let updateProfiles: typeof import("./playerProfiles").updateProfiles;
let getProfile: typeof import("./playerProfiles").getProfile;

beforeAll(async () => {
  ({ formatTopList } = await import("./commentary"));
  ({ updateProfiles, getProfile } = await import("./playerProfiles"));
});

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

describe("player profiles", () => {
  it("scores finishing position against the player's own division, not the whole field", () => {
    const chatId = -12345;
    const results = [
      ...Array.from({ length: 40 }, (_, i) => player(`Pro${i + 1}`, "MPO", i + 1, i)),
      ...Array.from({ length: 10 }, (_, i) => player(`Ama${i + 1}`, "MA3", i + 1, i + 20)),
    ];
    const tracked: TrackedPlayer[] = [{ ...player("Ama8", "MA3", 8, 27), id: 7 }];

    updateProfiles(chatId, tracked, results);

    // 8th of 10 in MA3 = 0.8, a back-of-the-pack finish. Dividing by the whole
    // 50-player field gave 0.16, which reads as "tyypillisesti kärjessä".
    expect(getProfile(chatId, "Ama8")?.avgPositionPct).toBe(0.8);
  });
});
