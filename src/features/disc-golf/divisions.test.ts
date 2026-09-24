import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Change, MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";

// Regression tests for the division bug: a competition's Results contain every
// division at once, and Metrix numbers positions WITHIN a division - so there
// is one OrderNumber === 1 per division. Anything that treated Results as a
// single ranking silently mixed divisions together.

// Keep the LLM path out of it - these assert the deterministic commentary, and
// the fallback generator takes the same division-filtered results.
process.env.LLM_ENABLED = "false";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "sakke-profiles-"));

let formatCommentaryMessage: typeof import("./commentary").formatCommentaryMessage;
let formatTopList: typeof import("./commentary").formatTopList;
let updateProfiles: typeof import("./playerProfiles").updateProfiles;
let getProfile: typeof import("./playerProfiles").getProfile;

beforeAll(async () => {
  ({ formatCommentaryMessage, formatTopList } = await import("./commentary"));
  ({ updateProfiles, getProfile } = await import("./playerProfiles"));
});

function player(name: string, className: string, orderNumber: number, diff: number): MetrixPlayerResult {
  return { Name: name, ClassName: className, OrderNumber: orderNumber, Diff: diff, Sum: 54 + diff };
}

function changeFor(newPlayer: MetrixPlayerResult, prevOrderNumber: number): Change {
  return {
    playerName: newPlayer.Name,
    playerId: 1,
    hole: 4,
    holeResult: { Result: "3", Diff: 0, PEN: 0 },
    prevPlayer: { ...newPlayer, OrderNumber: prevOrderNumber },
    newPlayer,
  };
}

describe("commentary standings context is scoped to the player's division", () => {
  it("does not report a division leader as sharing the lead with another division's leader", async () => {
    const matti = player("Matti", "MA3", 1, 2);
    const results = [
      player("Pro Player", "MPO", 1, -10),   // another division's leader, also OrderNumber 1
      player("Pro Runner", "MPO", 2, -8),
      matti,
      player("Toinen", "MA3", 2, 4),
    ];

    const message = await formatCommentaryMessage([changeFor(matti, 2)], "3145564", "Talin frisbeegolfrata", results, -100);

    // Unfiltered, results.filter(r => r.OrderNumber === 1).length was 2, so a
    // genuine solo division leader was announced as tied for the lead.
    expect(message).toContain("JOHTAA KISAA");
    expect(message).not.toContain("tasatilanteessa");
  });

  it("measures the gap to the leader within the division, not against another division's leader", async () => {
    const matti = player("Matti", "MA3", 2, 3);
    const results = [
      player("Pro Player", "MPO", 1, -10),   // 13 strokes ahead - a different competition, really
      matti,
      player("Amatoori", "MA3", 1, 2),       // the leader that actually matters: 1 ahead
    ];

    const message = await formatCommentaryMessage([changeFor(matti, 3)], "3145564", "Talin frisbeegolfrata", results, -100);

    // Against the MPO leader the gap was 13, so no "close behind" line appeared
    // at all; against his own division's leader it's 1.
    expect(message).toContain("vain 1 takana johtajasta");
  });

  it("falls back to the full field when a competition carries no division data", async () => {
    const matti = { ...player("Matti", "", 1, 2) };
    const results = [matti, { ...player("Toinen", "", 2, 4) }];

    const message = await formatCommentaryMessage([changeFor(matti, 2)], "3145564", "Talin frisbeegolfrata", results, -100);

    expect(message).toContain("JOHTAA KISAA");
  });
});

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
