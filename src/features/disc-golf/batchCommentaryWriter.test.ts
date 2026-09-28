import { describe, expect, it } from "vitest";
import { parseRoundState, parseStanding } from "./commentaryAnalysis";
import { parseScorecard } from "./commentaryFacts";
import { BatchCommentaryContext } from "./batchCommentaryContext";
import { writeBatchCommentary } from "./batchCommentaryWriter";
import { buildFactualFallback } from "./commentaryWriter";
import { buildFactualCommentaryBrief, CommentarySnapshot, FactualCommentaryBrief } from "./factualCommentaryBrief";

function buildBrief(playerName: string, previous: unknown, current: unknown): FactualCommentaryBrief {
  const makeSnapshot = (scorecard: unknown): CommentarySnapshot => ({
    scope: { chatId: -100, competitionId: "round", division: "MA3", playerId: playerName.length },
    playerName, courseName: "Meilahti",
    scorecard: parseScorecard(scorecard),
    round: parseRoundState({ totalHoles: 3 }),
    standing: parseStanding({ position: 1, fieldSize: 2, isProvisional: false }),
  });
  const result = buildFactualCommentaryBrief({ previousObserved: makeSnapshot(previous), current: makeSnapshot(current), lastPublished: null });
  if (result.kind !== "ready") throw new Error(`Expected a brief, received ${result.kind}`);
  return result.brief;
}

const ville = buildBrief("Ville Saarinen", [{ Result: 3, Diff: 0 }, [], []], [{ Result: 3, Diff: 0 }, { Result: 2, Diff: -1, PEN: 0 }, []]);
const tommi = buildBrief("tommi Virtanen", [{ Result: 3, Diff: 0 }, [], []], [{ Result: 3, Diff: 0 }, { Result: 5, Diff: 2, PEN: 1 }, []]);

const context: BatchCommentaryContext = {
  players: [ville, tommi],
  standings: [
    { playerName: "Ville Saarinen", position: 1, provisional: false, dnf: false, recordedHoles: 2, roundRelativeToPar: -1, leaderGap: { kind: "leader" } },
    { playerName: "tommi Virtanen", position: 2, provisional: false, dnf: false, recordedHoles: 2, roundRelativeToPar: 2, leaderGap: { kind: "behind", strokes: 3 } },
  ],
  scorecardTable: "Väylä | Par | Ville | Tommi", playOrderKnown: true, leadHistory: "Ville on johtanut kaikki 2 pelattua väylää.",
  weather: { current: "Sää: 8 °C.", changeSinceStart: null }, recentMessages: ["Aiempi viesti"],
  spokenNames: new Map([["Ville Saarinen", "Ville"], ["tommi Virtanen", "Tommi"]]),
};

const reply = (players: { name: string; text: string }[], overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ opening: "Ja sieltä lähtee.", players, closing: "Ville kärjessä.", ...overrides });

describe("batch commentary writer", () => {
  it("sends compact facts with spoken names and returns lines in the brief order", async () => {
    const result = await writeBatchCommentary(context, "Sakke", async messages => {
      const input = JSON.parse(messages[1].content);
      expect(input.players[0]).toEqual({
        name: "Ville", holes: [{ hole: "2", result: "birdie", ob: 0 }], roundTotal: -1,
        progress: "2/3", position: 1, provisional: false, positionChange: "ei tiedossa",
      });
      expect(input.players[1].holes).toEqual([{ hole: "2", result: "tuplabogi", ob: 1 }]);
      expect(input.standings.map((standing: { name: string; behindLeader: unknown }) => [standing.name, standing.behindLeader]))
        .toEqual([["Ville", "kärjessä"], ["Tommi", 3]]);
      expect(input).toMatchObject({ hole: "2", playOrder: "väylänumerojärjestys", recentMessages: ["Aiempi viesti"] });
      return reply([{ name: "tommi", text: "Tommi uimakouluun." }, { name: "Ville", text: "Ville lentää." }]);
    });
    expect(result).toEqual({
      kind: "generated",
      commentary: {
        opening: "Ja sieltä lähtee.", closing: "Ville kärjessä.",
        lines: [{ brief: ville, text: "Ville lentää." }, { brief: tommi, text: "Tommi uimakouluun." }],
      },
    });
  });

  it("removes result labels the model appends, even on their own line", async () => {
    const result = await writeBatchCommentary(context, "Sakke", async () => reply([
      { name: "Ville", text: "Ville lentää pönttöön! Tulos: Birdie." },
      { name: "Tommi", text: "Tommi uimakouluun.\n\nTulokset: 5 lyöntiä" },
    ]));
    expect(result.kind === "generated" && result.commentary.lines.map(line => line.text))
      .toEqual(["Ville lentää pönttöön!", "Tommi uimakouluun."]);
  });

  it.each([
    ["invalid JSON", "not json"],
    ["a line that is only a result label", reply([{ name: "Ville", text: "Tulos: par." }, { name: "Tommi", text: "b" }])],
    ["a missing player", reply([{ name: "Ville", text: "Ville lentää." }])],
    ["an unknown player", reply([{ name: "Ville", text: "a" }, { name: "Jori", text: "b" }])],
    ["a duplicated player", reply([{ name: "Ville", text: "a" }, { name: "Ville", text: "b" }])],
    ["an empty closing", reply([{ name: "Ville", text: "a" }, { name: "Tommi", text: "b" }], { closing: " " })],
  ])("falls back to factual lines on %s", async (_case, output) => {
    const result = await writeBatchCommentary(context, "Sakke", async () => output);
    expect(result).toEqual({
      kind: "fallback", reason: "unusable-response",
      commentary: { opening: "", closing: "", lines: [ville, tommi].map(brief => ({ brief, text: buildFactualFallback(brief) })) },
    });
  });

  it("falls back without exposing provider errors when generation fails", async () => {
    const result = await writeBatchCommentary(context, "Sakke", async () => { throw new Error("secret provider details"); });
    expect(result.kind).toBe("fallback");
    expect(JSON.stringify(result)).not.toContain("secret provider details");
  });
});
