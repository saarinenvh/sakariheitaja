import { describe, expect, it } from "vitest";
import { parseRoundState, parseStanding } from "./commentaryAnalysis";
import { parseScorecard } from "./commentaryFacts";
import { buildFactualCommentaryBrief, CommentarySnapshot } from "./factualCommentaryBrief";
import { buildFactualFallback, CommentaryPromptContext, writeFactualCommentary } from "./commentaryWriter";

function buildBrief(previous: unknown, current: unknown, holeCount = 3) {
  const makeSnapshot = (scorecard: unknown): CommentarySnapshot => ({
    scope: { chatId: -100, competitionId: "round", division: "MA3", playerId: 4 },
    playerName: "Matti",
    courseName: "Nummenmäki",
    scorecard: parseScorecard(scorecard),
    round: parseRoundState({ totalHoles: holeCount }),
    standing: parseStanding({ position: 8, fieldSize: 20, isProvisional: false }),
  });
  const result = buildFactualCommentaryBrief({
    previousObserved: makeSnapshot(previous), current: makeSnapshot(current), lastPublished: null,
  });
  if (result.kind !== "ready") throw new Error(`Expected a brief, received ${result.kind}`);
  return result.brief;
}

describe("factual commentary writer", () => {
  it("sends the factual brief and a single narrative-history field as structured context", async () => {
    const brief = buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]);
    const context: CommentaryPromptContext = {
      factualBrief: brief,
      narrativeHistory: [
        "No niin, Matti avasi kierroksen parilla. Eipä tässä vielä juhlia järjestetä.",
        "Jori sentään löysi birdien. Nyt Matti saa vähän seurata sivusta.",
      ],
    };
    const result = await writeFactualCommentary(context, "Sakke voice instructions", async messages => {
      expect(messages[0]).toEqual({ role: "system", content: "Sakke voice instructions" });
      const input = JSON.parse(messages[1].content);
      expect(input.narrativeHistory).toEqual(context.narrativeHistory);
      expect(input.factualBrief.events).toEqual(["Väylä 3: par (3 heittoa, väylän par-tulos, OB-määrä tuntematon)."]);
      expect(input.factualBrief).not.toHaveProperty("courseName");
      expect(input.factualBrief.movement).toContain("ei tiedetä");
      return "Matti pelaa parin, ja kortti etenee.";
    });
    expect(result).toEqual({ kind: "generated", text: "Matti pelaa parin, ja kortti etenee." });
  });

  it("separates a birdie from the round total and explicitly rules out OB", async () => {
    const brief = buildBrief([{ Result: 2, Diff: -1 }, [], []], [{ Result: 2, Diff: -1 }, { Result: 2, Diff: -1, PEN: 0 }, []]);
    await writeFactualCommentary({ factualBrief: brief, narrativeHistory: [] }, "Sakke", async messages => {
      const input = JSON.parse(messages[1].content);
      expect(input.factualBrief.events[0]).toContain("birdie (2 heittoa, 1 alle väylän parin, ei OB-merkintöjä)");
      expect(input.factualBrief.recordedRoundTotal).toContain("-2, 2 alle parin");
      return "Matti, birdie.";
    });
  });

  it("uses a factual deterministic fallback when generation fails", async () => {
    const brief = buildBrief([[], [], []], [[], [], { Result: 5, Diff: 2, PEN: 1 }]);
    const result = await writeFactualCommentary({ factualBrief: brief, narrativeHistory: [] }, "Sakke", async () => {
      throw new Error("secret provider details");
    });
    expect(result).toEqual({
      kind: "fallback",
      reason: "generation-failed",
      text: buildFactualFallback(brief),
    });
    expect(result.text).toContain("tuplabogi");
    expect(result.text).toContain("1 OB");
    expect(result.text).not.toContain("secret provider details");
  });

  it.each(["", "   ", 42, null, "Pelaaja: Matti", "Reaktiovihjeitä: iloinen"]) (
    "falls back when model output is empty or leaks prompt text (%j)", async output => {
      const brief = buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]);
      await expect(writeFactualCommentary({ factualBrief: brief, narrativeHistory: [] }, "Sakke", async () => output)).resolves.toEqual({
        kind: "fallback", reason: "unusable-response", text: buildFactualFallback(brief),
      });
    },
  );

  it("falls back when the generated commentary omits the player's name", async () => {
    const brief = buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]);
    await expect(writeFactualCommentary({ factualBrief: brief, narrativeHistory: [] }, "Sakke", async () => "Par. Kortti etenee.")).resolves.toEqual({
      kind: "fallback", reason: "unusable-response", text: buildFactualFallback(brief),
    });
  });

  it("describes score corrections and removals as edits instead of new achievements", () => {
    const brief = buildBrief(
      [{ Result: 5, Diff: 2 }, { Result: 3, Diff: 0 }, []],
      [{ Result: 4, Diff: 1 }, [], []],
    );
    const fallback = buildFactualFallback(brief);
    expect(fallback).toContain("tulos muuttui");
    expect(fallback).toContain("Matti:");
    expect(fallback).toContain("merkintä poistettiin");
    expect(fallback).not.toContain("uusi tulos");
  });

  it("varies the fallback opening deterministically across different updates", () => {
    const first = buildFactualFallback(buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]));
    const second = buildFactualFallback(buildBrief([[], [], [], []], [[], [], [], { Result: 3, Diff: 0 }], 4));
    expect(first).not.toBe(second);
    expect(first).toContain("Matti:");
    expect(first).toContain("Väylä 3: par");
    expect(second).toContain("Väylä 4: par");
  });

  it("does not make unsupported standing or completion claims", () => {
    const brief = buildBrief([[], [], []], [[], [], { Result: 3, Diff: 0 }]);
    const fallback = buildFactualFallback(brief);
    expect(fallback).toContain("Tämänhetkinen sijoitus");
    expect(fallback).not.toContain("nousua");
    expect(fallback).not.toContain("Kierros valmis");
  });
});
