import { describe, it, expect } from "vitest";
import { formatBagtagAnnouncement } from "./bagtags";

describe("formatBagtagAnnouncement", () => {
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
