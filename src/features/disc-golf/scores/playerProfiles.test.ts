import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { MetrixPlayerResult, TrackedPlayer } from "../../../types/metrix";

// The profile store reads DATA_DIR when the module loads, so it is set before the import.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "sakke-profiles-"));

let updateProfiles: typeof import("./playerProfiles").updateProfiles;
let getProfile: typeof import("./playerProfiles").getProfile;

beforeAll(async () => {
  ({ updateProfiles, getProfile } = await import("./playerProfiles"));
});

function player(name: string, className: string, orderNumber: number, diff: number): MetrixPlayerResult {
  return { Name: name, ClassName: className, OrderNumber: orderNumber, Diff: diff, Sum: 54 + diff };
}

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
