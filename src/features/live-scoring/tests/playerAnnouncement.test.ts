import { describe, expect, it } from "vitest";
import { formatPlayerAnnouncement } from "../playerAnnouncement";

describe("player announcement", () => {
  it("links the course and lists the escaped player names", () => {
    const message = formatPlayerAnnouncement("3809486", "Veikkola &rarr; Main", ["Ville", "Teppo <3"], []);
    expect(message).toBe(
      'Peliareenana toimii <a href="https://discgolfmetrix.com/3809486">Veikkola  Main</a>\n\n'
      + "Ja tällä kertaa kisassa on mukana:\nVille\nTeppo &lt;3\n",
    );
  });

  it("tells who still has no bagtag", () => {
    const message = formatPlayerAnnouncement("1", "Rata", ["Ville"], ["Ville"]);
    expect(message).toContain("\n🏷️ Ilman tägiä: Ville\nAseta: /bagtag set [nimi] [numero]");
  });
});
