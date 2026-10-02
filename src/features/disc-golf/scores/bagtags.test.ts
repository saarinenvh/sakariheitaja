import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { formatBagtagAnnouncement } from "./bagtags";

describe("formatBagtagAnnouncement", () => {
  it("keeps a DNF tag holder in allocation when their ranking and score are unknown", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sakke-dnf-tags-"));
    vi.stubEnv("DATA_DIR", directory);
    vi.resetModules();
    try {
      const tags = await import("./bagtags");
      tags.setBagtag(-100, "DNF", 1);
      tags.setBagtag(-100, "Finisher", 2);
      const players = [
        { playerName: "DNF", relativeToPar: null, group: "1", dnf: true },
        { playerName: "Finisher", relativeToPar: 3, group: "1", dnf: false },
      ];
      expect(tags.computeAndApplySwaps(-100, players).swaps).toEqual([
        { playerName: "Finisher", from: 2, to: 1 },
        { playerName: "DNF", from: 1, to: 2 },
      ]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true });
    }
  });
  it("does not announce a swap when nothing swapped", () => {
    // The early return only covers "no swaps AND nobody untagged", so this
    // combination used to print the "Bag Tag vaihdettu!" header over a list of
    // tags that had not moved.
    const msg = formatBagtagAnnouncement({
      swaps: [],
      unchanged: [{ playerName: "Matti", tag: 3 }],
      noTag: ["Pekka"],
    });
    expect(msg).not.toContain("vaihdettu");
    expect(msg).toContain("Pekka");
  });

  it("announces a real swap", () => {
    const msg = formatBagtagAnnouncement({
      swaps: [{ playerName: "Matti", from: 7, to: 3 }],
      unchanged: [],
      noTag: [],
    });
    expect(msg).toContain("vaihdettu");
    expect(msg).toContain("#7");
    expect(msg).toContain("#3");
  });

  it("says nothing happened when there is nothing to say", () => {
    const msg = formatBagtagAnnouncement({ swaps: [], unchanged: [], noTag: [] });
    expect(msg).toContain("ei vaihtoja");
  });
});
