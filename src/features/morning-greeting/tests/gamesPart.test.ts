import { describe, expect, it } from "vitest";
import { formatGamesPart } from "../gamesPart";
import { gamesJoinLine } from "../messages";
import type { GamePlan } from "../../games";

const TODAY = "2026-10-10";

/** A plan with only the fields the part reads. */
function plan(id: number, day: string, courses: string[], players: string[] = []): GamePlan {
  return { id, day, startTime: null, courses, players: players.map(name => ({ name })) } as GamePlan;
}

describe("the greeting's games part", () => {
  it("lists today's games and the coming days' games apart, then invites", () => {
    const part = formatGamesPart([plan(12, TODAY, ["Karjaa"], ["Ville"]), plan(13, "2026-10-11", ["Tali"])], TODAY);

    expect(part).toBe(
      `Tänään pelataan:\n12. la 10.10. Karjaa — Ville\n\nTulossa:\n13. su 11.10. Tali\n\n${gamesJoinLine}`,
    );
  });

  it("leaves out the today section when nothing is planned for today", () => {
    const part = formatGamesPart([plan(13, "2026-10-11", ["Tali"])], TODAY);

    expect(part).toBe(`Tulossa:\n13. su 11.10. Tali\n\n${gamesJoinLine}`);
  });

  it("leaves out the upcoming section when only today has games", () => {
    const part = formatGamesPart([plan(12, TODAY, ["Karjaa"])], TODAY);

    expect(part).toBe(`Tänään pelataan:\n12. la 10.10. Karjaa\n\n${gamesJoinLine}`);
  });
});
