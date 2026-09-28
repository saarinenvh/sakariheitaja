import { describe, expect, it, vi } from "vitest";
import { CommentaryPromptContext, writeFactualCommentary } from "./commentaryWriter";
import { CommentaryDelivery, RoundCommentary } from "./roundCommentary";
import { hasTrackedRoundEnded, parseMetrixRound, toBagtagPlayers, toFinalScores, trackRoundPlayers } from "./metrixRound";
import { formatCommentaryMessages, TELEGRAM_MESSAGE_LIMIT } from "./commentaryPresentation";

const tracked = [{ id: 1, name: "Matti" }, { id: 2, name: "Jori" }];
const score = (strokes: number, relativeToPar = strokes - 3) => ({ Result: String(strokes), Diff: relativeToPar, PEN: "0" });

function input(holes: unknown = [[], [], [], []], position: unknown = "11", division = "MA3") {
  return {
    Competition: {
      ID: "123", Name: "Kierros", Date: "2026-09-27", CourseName: "Testirata", Type: "2",
      SubCompetitions: [] as unknown[],
      Tracks: Array.from({ length: 4 }, (_, index) => ({ Number: String(index + 1), NumberAlt: "", Par: "3" })),
      Results: [
        { Name: "Matti", ClassName: division, UserID: "130", OrderNumber: position, PlayerResults: holes, DNF: null as string | null },
        ...Array.from({ length: 19 }, (_, index) => ({
          Name: `Other ${index}`, ClassName: division, UserID: String(index + 200),
          OrderNumber: index + 1, PlayerResults: [[], [], [], []], DNF: null as string | null,
        })),
      ],
    },
  };
}

function harness(chatId = -100, roundId = "123", writer?: CommentaryDelivery["write"]) {
  const contexts: CommentaryPromptContext[] = [];
  const send = vi.fn<(html: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const saveScores = vi.fn<CommentaryDelivery["saveScores"]>().mockResolvedValue(undefined);
  const onError = vi.fn<CommentaryDelivery["onError"]>();
  const session = new RoundCommentary(chatId, roundId, {
    write: async context => {
      contexts.push(context);
      if (writer) return writer(context);
      return { kind: "generated", text: `${context.factualBrief.playerName}: kommentti ${contexts.length}` };
    },
    send, saveScores, onError, opening: () => "HOI! Nyt taas tapahtuu!",
  });
  const observe = (raw: unknown) => {
    const round = parseMetrixRound(raw, roundId);
    return session.observe(round, trackRoundPlayers(round, tracked));
  };
  return { session, contexts, send, saveScores, onError, observe };
}

describe("Metrix round boundary", () => {
  it("accepts training payloads without SubCompetitions and rejects explicit parent flags", () => {
    const { SubCompetitions: _children, ...training } = input().Competition;
    const raw = { Competition: { ...training, ID: 123, Type: "1", HasSubcompetitions: 0 } };
    expect(parseMetrixRound(raw, "123").id).toBe("123");
    expect(() => parseMetrixRound({ Competition: { ...raw.Competition, HasSubcompetitions: 1 } }, "123"))
      .toThrow("yksittäisiä kierroksia");
  });
  it("normalizes numeric rankings and OB fields, and uses the verified layout labels", () => {
    const raw = input([{ Result: "4", Diff: "1", OB: "1" }, [], [], []], "10");
    raw.Competition.Tracks[0].NumberAlt = "6A";
    const round = parseMetrixRound(raw, "123");
    expect(round.holeLabels[0]).toBe("6A");
    expect(round.players[0]).toMatchObject({
      totalStrokes: null, totalRelativeToPar: null,
      standing: { position: 10, fieldSize: 20, isProvisional: false },
      scorecard: { kind: "available", holes: [{ strokes: 4, relativeToPar: 1, obCount: 1 }, null, null, null] },
    });
  });

  it("rejects parent events, missing layouts, wrong IDs and malformed scores", () => {
    const parent = input();
    parent.Competition.SubCompetitions = [{ ID: "124" }];
    expect(() => parseMetrixRound(parent, "123")).toThrow("yksittäisiä kierroksia");
    const noLayout = input();
    noLayout.Competition.Tracks = [];
    expect(() => parseMetrixRound(noLayout, "123")).toThrow("yksittäisiä kierroksia");
    expect(() => parseMetrixRound(input(), "124")).toThrow("different round ID");
    expect(() => parseMetrixRound(input([{ Result: "bad" }, [], [], []]), "123")).toThrow();
  });

  it("keeps missing metadata unknown and mismatched cards unavailable", () => {
    const round = parseMetrixRound(input([{ Result: "3" }, [], [], []], null), "123");
    expect(round.players[0]).toMatchObject({
      totalRelativeToPar: null, standing: { position: null, isProvisional: true },
    });
    const truncated = parseMetrixRound(input([score(3)]), "123");
    expect(truncated.players[0].scorecard.kind).toBe("unavailable");
    expect(hasTrackedRoundEnded(trackRoundPlayers(truncated, tracked))).toBe(false);
  });

  it("requires all known layout slots or DNF to stop tracking", () => {
    const active = parseMetrixRound(input([[], [], [], score(3)]), "123");
    expect(hasTrackedRoundEnded(trackRoundPlayers(active, tracked))).toBe(false);
    const full = parseMetrixRound(input([score(3), score(3), score(3), score(3)]), "123");
    expect(hasTrackedRoundEnded(trackRoundPlayers(full, tracked))).toBe(true);
    expect(toFinalScores(trackRoundPlayers(full, tracked))).toEqual([{ id: 1, Sum: 12, Diff: 0 }]);
    expect(full.players[0].round.status).toBe("active");
    const dnf = input();
    dnf.Competition.Results[0].DNF = "1";
    expect(hasTrackedRoundEnded(trackRoundPlayers(parseMetrixRound(dnf, "123"), tracked))).toBe(true);
    expect(toBagtagPlayers(trackRoundPlayers(parseMetrixRound(dnf, "123"), tracked)))
      .toEqual([{ Name: "Matti", Diff: null, Group: "1", DNF: "1" }]);
    const incompleteMetadata = parseMetrixRound(input(Array.from({ length: 4 }, () => ({ Result: "3" }))), "123");
    expect(hasTrackedRoundEnded(trackRoundPlayers(incompleteMetadata, tracked))).toBe(false);
  });

  it("avoids ambiguous names and treats aggregate standings as provisional", () => {
    const ambiguous = input();
    ambiguous.Competition.Results.push({ ...ambiguous.Competition.Results[0], UserID: "999" });
    expect(trackRoundPlayers(parseMetrixRound(ambiguous, "123"), tracked)).toEqual([]);
    const raw = input();
    const round = parseMetrixRound({ Competition: { ...raw.Competition, ShowPreviousRoundsSum: "1" } }, "123");
    expect(round.players[0].standing.isProvisional).toBe(true);
  });
});

describe("round publication", () => {
  it("keeps each player's history private while capturing current competition facts", async () => {
    const test = harness();
    const makeRound = (holes: unknown[]) => {
      const raw = input(holes, "1");
      raw.Competition.Results[1] = { ...raw.Competition.Results[1], Name: "Jori", OrderNumber: 2, PlayerResults: holes };
      return raw;
    };
    test.observe(makeRound([[], [], [], []]));
    test.observe(makeRound([score(3), [], [], []]));
    await test.session.idle();
    test.observe(makeRound([score(3), score(2), [], []]));
    await test.session.idle();
    expect(test.contexts[2].narrativeHistory).toEqual(["Matti: kommentti 1"]);
    expect(test.contexts[3].narrativeHistory).toEqual(["Jori: kommentti 2"]);
    expect(test.contexts[2].competitionFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Jori", roundRelativeToPar: -1 }),
    ]));
  });
  it("uses the last delivered position, including when later polls arrive during generation", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []], "11"));
    test.observe(input([score(3), score(3), [], []], "10"));
    await test.session.idle();
    expect(test.contexts[0].factualBrief.movementSincePublication.kind).toBe("unknown");
    expect(test.contexts[1].factualBrief.movementSincePublication).toMatchObject({ kind: "up", places: 1 });
    expect(test.send.mock.calls[1][0]).toContain("sija 10 ↑");
    expect(test.contexts[1].narrativeHistory).toEqual(["Matti: kommentti 1"]);
    expect(test.observe(input([score(3), score(3), [], []], "10"))).toBe(false);
    await test.session.idle();
    expect(test.send).toHaveBeenCalledTimes(2);
  });

  it("does not advance history or rankings on failed sends and recovers for later polls", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []], "11"));
    await test.session.idle();
    test.send.mockRejectedValueOnce(new Error("Telegram timeout"));
    test.observe(input([score(3), score(4), [], []], "15"));
    await test.session.idle();
    test.observe(input([score(3), score(4), score(3), []], "10"));
    await test.session.idle();
    expect(test.contexts[2].factualBrief.movementSincePublication).toMatchObject({ kind: "up", previousPosition: 11 });
    expect(test.contexts[2].narrativeHistory).toEqual(["Matti: kommentti 1"]);
    expect(test.onError).toHaveBeenCalledTimes(1);
    expect(test.saveScores).toHaveBeenCalledTimes(2);
  });

  it("detects offsetting corrections, metadata corrections, removals and catch-up batches", async () => {
    const test = harness();
    test.observe(input([score(3), score(4), [], []]));
    test.observe(input([score(4), score(3), score(1, -2), score(2, -1)]));
    await test.session.idle();
    const first = test.contexts[0].factualBrief;
    expect(first.event).toBe("mixed-update");
    expect(first.changes.map(change => change.kind)).toEqual(["corrected", "corrected", "recorded", "recorded"]);
    expect(test.saveScores.mock.calls[0][2].map(change => change.holeNumber)).toEqual([3, 4]);
    test.observe(input([{ ...score(4), PEN: "1" }, [], score(1, -2), score(2, -1)]));
    await test.session.idle();
    expect(test.contexts[1].factualBrief.changes.map(change => change.kind)).toEqual(["corrected", "removed"]);
    expect(test.send.mock.calls[1][0]).toContain("poistettu");
    expect(test.saveScores.mock.calls[1][2]).toEqual([]);
    test.observe(input([score(4), score(1, -2), score(1, -2), score(2, -1)]));
    await test.session.idle();
    expect(test.saveScores.mock.calls[2][2]).toEqual([]);
  });

  it("isolates chat and round sessions and division histories", async () => {
    const first = harness();
    const otherChat = harness(-200);
    first.observe(input());
    first.observe(input([score(3), [], [], []]));
    await first.session.idle();
    otherChat.observe(input([score(3), [], [], []]));
    otherChat.observe(input([score(3), score(3), [], []], "1"));
    await otherChat.session.idle();
    expect(otherChat.contexts[0].narrativeHistory).toEqual([]);
    expect(otherChat.contexts[0].factualBrief.movementSincePublication.kind).toBe("unknown");
    const otherRound = harness(-100, "124");
    const initial = input();
    initial.Competition.ID = "124";
    otherRound.observe(initial);
    const changed = input([score(3), [], [], []]);
    changed.Competition.ID = "124";
    otherRound.observe(changed);
    await otherRound.session.idle();
    expect(otherRound.contexts[0].narrativeHistory).toEqual([]);
    first.observe(input([score(3), [], [], []], "1", "MPO"));
    first.observe(input([score(3), score(3), [], []], "1", "MPO"));
    await first.session.idle();
    expect(first.contexts[1].narrativeHistory).toEqual([]);
    expect(first.contexts[1].factualBrief.movementSincePublication.kind).toBe("unknown");
  });

  it("rebaselines after missing cards, changed layouts or source identity", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.observe(input(null));
    test.observe(input([score(3), score(3), [], []]));
    await test.session.idle();
    const switched = input([score(3), score(3), [], []]);
    switched.Competition.Results[0].UserID = "900";
    test.observe(switched);
    const newLayout = input([score(3), score(3), score(3), []]);
    newLayout.Competition.Tracks[0].NumberAlt = "1B";
    test.observe(newLayout);
    await test.session.idle();
    expect(test.contexts).toHaveLength(1);
    newLayout.Competition.Results[0].PlayerResults = [score(3), score(3), score(3), score(4)];
    test.observe(newLayout);
    await test.session.idle();
    expect(test.contexts[1].narrativeHistory).toEqual([]);
    expect(test.contexts[1].factualBrief.movementSincePublication.kind).toBe("unknown");
  });

  it("saves published state even if the later score database write fails", async () => {
    const test = harness();
    test.saveScores.mockRejectedValueOnce(new Error("database offline"));
    test.observe(input());
    test.observe(input([score(1, -2), [], [], []]));
    test.observe(input([score(1, -2), score(3), [], []], "10"));
    await test.session.idle();
    expect(test.contexts[1].narrativeHistory).toEqual(["Matti: kommentti 1"]);
    expect(test.contexts[1].factualBrief.movementSincePublication.kind).toBe("up");
  });

  it("retains the published ranking through an unavailable scorecard", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []], "11"));
    test.observe(input(null, "15"));
    test.observe(input([score(3), [], [], []], "15"));
    test.observe(input([score(3), score(3), [], []], "10"));
    await test.session.idle();
    expect(test.contexts[1].factualBrief.movementSincePublication).toMatchObject({ kind: "up", previousPosition: 11 });
    expect(test.contexts[1].narrativeHistory).toEqual(["Matti: kommentti 1"]);
  });

  it("records the facts and text of successful fragments even when a later fragment fails", async () => {
    let generation = 0;
    const longText = `Matti ${"pitkä kommentti ".repeat(600)}`;
    const test = harness(-100, "123", async () => ({
      kind: "generated", text: ++generation === 2 ? longText : "Matti, ihan jees.",
    }));
    test.observe(input());
    test.observe(input([score(3), [], [], []], "2"));
    await test.session.idle();
    test.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("second fragment failed"));
    test.observe(input([score(3), score(2), [], []], "1"));
    await test.session.idle();
    test.observe(input([score(3), score(2), score(4), []], "2"));
    await test.session.idle();
    expect(test.contexts[2].factualBrief.movementSincePublication).toMatchObject({ kind: "down", previousPosition: 1 });
    const delivered = test.contexts[2].narrativeHistory[1];
    expect(delivered.length).toBeGreaterThan(0);
    expect(delivered.length).toBeLessThan(longText.length);
    expect(longText.startsWith(delivered)).toBe(true);
    expect(test.saveScores).toHaveBeenCalledTimes(3);
  });

  it("passes the whole story beyond six updates without compaction", async () => {
    const test = harness();
    test.observe(input());
    for (let iteration = 0; iteration < 9; iteration++) {
      test.observe(input([score(3 + iteration), [], [], []]));
    }
    await test.session.idle();
    expect(test.contexts[8].narrativeHistory).toEqual(Array.from({ length: 8 }, (_, index) => `Matti: kommentti ${index + 1}`));
  });

  it("uses model-error fallback as the delivered story", async () => {
    const test = harness(-100, "123", context => writeFactualCommentary(context, "Sakke", async () => {
      throw new Error("private failure");
    }));
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.observe(input([score(3), score(4), [], []]));
    await test.session.idle();
    expect(test.send).toHaveBeenCalledTimes(2);
    expect(test.contexts[1].narrativeHistory[0]).toContain("Matti");
    expect(test.contexts[1].narrativeHistory[0]).not.toContain("private failure");
  });

  it("stops queued delivery on stop", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.session.stop();
    await test.session.idle();
    expect(test.send).not.toHaveBeenCalled();
  });

  it("escapes and splits long text without breaking entities or losing delivered fragments", async () => {
    const context: CommentaryPromptContext = {
      factualBrief: { playerName: "Matti", courseName: "Testirata", division: "MA3", event: "scores-recorded",
        changes: [{ kind: "recorded", holeNumber: 1, score: { strokes: 3, relativeToPar: 0, obCount: null } }],
        round: { progress: { kind: "unknown" }, recordedStrokes: 3, recordedRelativeToPar: 0, scores: null },
        standing: { position: null, fieldSize: null, isProvisional: true }, movementSincePublication: { kind: "unknown" }, limitations: [],
      }, narrativeHistory: [],
    };
    const fallback = await writeFactualCommentary(context, "Sakke", async () => { throw new Error("private failure"); });
    expect(fallback.kind).toBe("fallback");
    const messages = formatCommentaryMessages([{ brief: context.factualBrief, text: `<Matti> & ${"😀".repeat(4000)}` }], "123", "HOI!");
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every(message => message.html.length <= TELEGRAM_MESSAGE_LIMIT)).toBe(true);
    expect(messages[0].html).toContain("&lt;Matti&gt; &amp;");
    const fragments = messages.flatMap(message => message.published);
    expect(fragments.filter(fragment => fragment.firstFragment)).toHaveLength(1);
    expect(fragments.map(fragment => fragment.text).join("")).toBe(`<Matti> & ${"😀".repeat(4000)}`);
  });
});
