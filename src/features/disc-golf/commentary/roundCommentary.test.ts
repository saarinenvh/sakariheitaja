import { describe, expect, it, vi } from "vitest";
import { WeatherObservation } from "../../../shared/weather";
import { BatchCommentaryContext } from "./facts/commentaryContext";
import { BatchCommentaryResult, writeBatchCommentary } from "./write/commentaryWriter";
import { CommentaryDelivery, RoundCommentary } from "./roundCommentary";
import { hasTrackedRoundEnded, selectFinalScores, trackRoundPlayers } from "../../../integrations/metrix/round/results";
import { parseMetrixRound } from "../../../integrations/metrix/round/normalize";
import { selectBagtagParticipants } from "../scores/bagtags";
import { formatBatchCommentaryMessages, TELEGRAM_MESSAGE_LIMIT } from "./format/commentaryMessage";
import { FactualCommentaryBrief } from "./facts/playerBrief";

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

function generatedCommentary(context: BatchCommentaryContext, count: number): BatchCommentaryResult {
  return {
    kind: "generated",
    commentary: {
      opening: `Avaus ${count}`,
      lines: context.players.map(brief => ({ brief, text: `${brief.playerName}: kommentti ${count}` })),
      closing: `Loppu ${count}`,
    },
  };
}

function weatherAt(temperatureC: number): WeatherObservation {
  return { observedAt: new Date("2026-09-28T12:00:00Z"), temperatureC, windSpeedMs: 4, windFromDeg: null, description: "pilvistä", precipitationMmPerHour: null };
}

function harness(chatId = -100, roundId = "123", writer?: CommentaryDelivery["write"]) {
  const contexts: BatchCommentaryContext[] = [];
  const send = vi.fn<(html: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const saveScores = vi.fn<CommentaryDelivery["saveScores"]>().mockResolvedValue(undefined);
  const onError = vi.fn<CommentaryDelivery["onError"]>();
  const fetchWeather = vi.fn<CommentaryDelivery["fetchWeather"]>().mockResolvedValue(null);
  const fetchCourse = vi.fn<CommentaryDelivery["fetchCourse"]>().mockResolvedValue({ details: null, statistics: null });
  const session = new RoundCommentary(chatId, roundId, {
    write: async context => {
      contexts.push(context);
      if (writer) return writer(context);
      return generatedCommentary(context, contexts.length);
    },
    fetchWeather, fetchCourse, send, saveScores, onError,
  });
  const observe = (raw: unknown) => {
    const round = parseMetrixRound(raw, roundId);
    return session.observe(round, trackRoundPlayers(round, tracked));
  };
  return { session, contexts, send, saveScores, onError, fetchWeather, fetchCourse, observe };
}

const firstPlayer = (context: BatchCommentaryContext): FactualCommentaryBrief => context.players[0];

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
    expect(selectFinalScores(trackRoundPlayers(full, tracked))).toEqual([{ playerId: 1, strokes: 12, relativeToPar: 0 }]);
    expect(full.players[0].round.status).toBe("complete");
    expect(active.players[0].round.status).toBe("active");
    const dnf = input();
    dnf.Competition.Results[0].DNF = "1";
    expect(hasTrackedRoundEnded(trackRoundPlayers(parseMetrixRound(dnf, "123"), tracked))).toBe(true);
    expect(selectBagtagParticipants(trackRoundPlayers(parseMetrixRound(dnf, "123"), tracked)))
      .toEqual([{ playerName: "Matti", relativeToPar: null, group: "1", dnf: true }]);
    const incompleteMetadata = parseMetrixRound(input(Array.from({ length: 4 }, () => ({ Result: "3" }))), "123");
    expect(hasTrackedRoundEnded(trackRoundPlayers(incompleteMetadata, tracked))).toBe(false);
  });

  it("gives tied players reported at place 0 or without a place a shared place from recorded totals", () => {
    const raw = input([score(3), score(3), [], []], "0");
    const results = raw.Competition.Results;
    results[1] = { ...results[1], Name: "Teppo", OrderNumber: 0, PlayerResults: [score(2), score(4), [], []] };
    results[2] = { ...results[2], Name: "Tommi", OrderNumber: null, PlayerResults: [score(4), score(3), [], []] };
    results[3] = { ...results[3], Name: "Aloittamaton", OrderNumber: 0 };
    results[4] = { ...results[4], ClassName: "MPO", OrderNumber: 0, PlayerResults: [score(1, -2), [], [], []] };
    const players = parseMetrixRound(raw, "123").players;
    expect(players.slice(0, 4).map(player => player.standing)).toEqual([
      { position: 1, fieldSize: 19, isProvisional: false },
      { position: 1, fieldSize: 19, isProvisional: false },
      { position: 3, fieldSize: 19, isProvisional: false },
      { position: null, fieldSize: 19, isProvisional: true },
    ]);
    const aggregate = parseMetrixRound({ Competition: { ...raw.Competition, ShowPreviousRoundsSum: "1" } }, "123");
    expect(aggregate.players[0].standing).toMatchObject({ position: null, isProvisional: true });
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
  const withJori = (holes: unknown[], joriHoles: unknown[] = holes) => {
    const raw = input(holes, "1");
    raw.Competition.Results[1] = { ...raw.Competition.Results[1], Name: "Jori", OrderNumber: 2, PlayerResults: joriHoles };
    return raw;
  };

  it("writes one message per division update with every player, standings and the scorecard", async () => {
    const test = harness();
    test.observe(withJori([[], [], [], []]));
    test.observe(withJori([score(3), [], [], []], [score(2), [], [], []]));
    await test.session.idle();
    expect(test.contexts).toHaveLength(1);
    expect(test.contexts[0].players.map(brief => brief.playerName)).toEqual(["Matti", "Jori"]);
    expect(test.contexts[0].standings).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Jori", roundRelativeToPar: -1 }),
    ]));
    expect(test.contexts[0].scorecardTable).toContain("par* | birdie*");
    expect(test.send).toHaveBeenCalledTimes(1);
    const html = test.send.mock.calls[0][0];
    const order = ["Avaus 1", "Matti: kommentti 1", "Jori: kommentti 1", "Loppu 1"].map(part => html.indexOf(part));
    expect(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1]))).toBe(true);
    expect(test.saveScores).toHaveBeenCalledTimes(2);
  });

  it("passes only the latest delivered messages of the division as recent context", async () => {
    const test = harness();
    test.observe(input());
    for (let iteration = 0; iteration < 5; iteration++) test.observe(input([score(3 + iteration), [], [], []]));
    await test.session.idle();
    expect(test.contexts[1].recentMessages).toEqual(["Avaus 1\nMatti: kommentti 1\nLoppu 1"]);
    expect(test.contexts[4].recentMessages).toEqual([2, 3, 4].map(count => `Avaus ${count}\nMatti: kommentti ${count}\nLoppu ${count}`));
  });

  it("uses the last delivered position, including when later polls arrive during generation", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []], "11"));
    test.observe(input([score(3), score(3), [], []], "10"));
    await test.session.idle();
    expect(firstPlayer(test.contexts[0]).movementSincePublication.kind).toBe("unknown");
    expect(firstPlayer(test.contexts[1]).movementSincePublication).toMatchObject({ kind: "up", places: 1 });
    expect(test.send.mock.calls[1][0]).toContain("sija 10 ↑");
    expect(test.observe(input([score(3), score(3), [], []], "10"))).toBe(false);
    await test.session.idle();
    expect(test.send).toHaveBeenCalledTimes(2);
  });

  it("does not advance messages or rankings on failed sends and recovers for later polls", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []], "11"));
    await test.session.idle();
    test.send.mockRejectedValueOnce(new Error("Telegram timeout"));
    test.observe(input([score(3), score(4), [], []], "15"));
    await test.session.idle();
    test.observe(input([score(3), score(4), score(3), []], "10"));
    await test.session.idle();
    expect(firstPlayer(test.contexts[2]).movementSincePublication).toMatchObject({ kind: "up", previousPosition: 11 });
    expect(test.contexts[2].recentMessages).toEqual(["Avaus 1\nMatti: kommentti 1\nLoppu 1"]);
    expect(test.onError).toHaveBeenCalledTimes(1);
    expect(test.saveScores).toHaveBeenCalledTimes(2);
  });

  it("detects offsetting corrections, metadata corrections, removals and catch-up batches", async () => {
    const test = harness();
    test.observe(input([score(3), score(4), [], []]));
    test.observe(input([score(4), score(3), score(1, -2), score(2, -1)]));
    await test.session.idle();
    const first = firstPlayer(test.contexts[0]);
    expect(first.event).toBe("mixed-update");
    expect(first.changes.map(change => change.kind)).toEqual(["corrected", "corrected", "recorded", "recorded"]);
    expect(test.saveScores.mock.calls[0][2].map(change => change.holeNumber)).toEqual([3, 4]);
    test.observe(input([{ ...score(4), PEN: "1" }, [], score(1, -2), score(2, -1)]));
    await test.session.idle();
    expect(firstPlayer(test.contexts[1]).changes.map(change => change.kind)).toEqual(["corrected", "removed"]);
    expect(test.send.mock.calls[1][0]).toContain("poistettu");
    expect(test.saveScores.mock.calls[1][2]).toEqual([]);
  });

  it("isolates chat, round and division sessions", async () => {
    const first = harness();
    const otherChat = harness(-200);
    first.observe(input());
    first.observe(input([score(3), [], [], []]));
    await first.session.idle();
    otherChat.observe(input([score(3), [], [], []]));
    otherChat.observe(input([score(3), score(3), [], []], "1"));
    await otherChat.session.idle();
    expect(otherChat.contexts[0].recentMessages).toEqual([]);
    expect(firstPlayer(otherChat.contexts[0]).movementSincePublication.kind).toBe("unknown");
    first.observe(input([score(3), [], [], []], "1", "MPO"));
    first.observe(input([score(3), score(3), [], []], "1", "MPO"));
    await first.session.idle();
    expect(first.contexts[1].recentMessages).toEqual([]);
    expect(firstPlayer(first.contexts[1]).movementSincePublication.kind).toBe("unknown");
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
    expect(test.contexts[1].recentMessages).toEqual([]);
    expect(firstPlayer(test.contexts[1]).movementSincePublication.kind).toBe("unknown");
  });

  it("saves published state even if the later score database write fails", async () => {
    const test = harness();
    test.saveScores.mockRejectedValueOnce(new Error("database offline"));
    test.observe(input());
    test.observe(input([score(1, -2), [], [], []]));
    test.observe(input([score(1, -2), score(3), [], []], "10"));
    await test.session.idle();
    expect(test.contexts[1].recentMessages).toHaveLength(1);
    expect(firstPlayer(test.contexts[1]).movementSincePublication.kind).toBe("up");
  });

  it("delivers a factual fallback without leaking errors or remembering it as a message", async () => {
    const test = harness(-100, "123", context => writeBatchCommentary(context, "Sakke", async () => {
      throw new Error("private failure");
    }));
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.observe(input([score(3), score(4), [], []]));
    await test.session.idle();
    expect(test.send).toHaveBeenCalledTimes(2);
    expect(test.send.mock.calls[0][0]).toContain("Matti");
    expect(test.send.mock.calls[0][0]).not.toContain("private failure");
    expect(test.contexts[1].recentMessages).toEqual([]);
  });

  it("fetches weather for the first update and reports a change only when rechecked past halfway", async () => {
    const test = harness();
    test.fetchWeather.mockResolvedValueOnce(weatherAt(12)).mockResolvedValueOnce(weatherAt(7));
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.observe(input([score(3), score(3), [], []]));
    test.observe(input([score(3), score(3), score(3), []]));
    await test.session.idle();
    expect(test.contexts[0].weather).toEqual({ current: expect.stringContaining("12 °C"), changeSinceStart: null });
    expect(test.contexts[1].weather).toEqual({ current: expect.stringContaining("7 °C"), changeSinceStart: expect.stringContaining("5 °C") });
    expect(test.contexts[2].weather).toBeNull();
    expect(test.fetchWeather).toHaveBeenCalledTimes(2);
  });

  it("marks only the first delivered message of a division as the welcome, retrying it after a failed send", async () => {
    const test = harness();
    test.send.mockRejectedValueOnce(new Error("Telegram timeout"));
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.observe(input([score(3), score(3), [], []]));
    test.observe(input([score(3), score(3), score(3), []]));
    await test.session.idle();
    expect(test.contexts.map(context => context.firstMessage)).toEqual([true, true, false]);
  });

  describe("course data is optional enrichment", () => {
    const layout = {
      courseId: "1", location: null, rating: { value1: 909.61, result1: 63.06, value2: 1000, result2: 55.53 },
      holes: ["1", "2", "3", "4"].map(label => ({ label, par: 3, lengthM: label === "1" ? 57 : 90, tee: null, basket: null })),
    };

    it("adds hole and course facts when Metrix provides them", async () => {
      const test = harness();
      test.fetchCourse.mockResolvedValue({ details: layout, statistics: null });
      test.observe(input());
      test.observe(input([score(3), [], [], []]));
      await test.session.idle();
      expect(test.contexts[0].holeFacts).toBe("Väylä 1: Par 3, 57 m, radan lyhyin.");
      expect(test.contexts[0].courseDifficulty).toContain("par-rating");
      expect(test.fetchCourse).toHaveBeenCalledTimes(1);
    });

    it("rates a round once the player's card is complete and shows it in the result row", async () => {
      const test = harness();
      test.fetchCourse.mockResolvedValue({ details: layout, statistics: null });
      test.observe(input([score(3), score(3), score(3), []]));
      test.observe(input([score(3), score(3), score(3), score(2)]));
      await test.session.idle();
      expect(firstPlayer(test.contexts[0]).round.progress.kind).toBe("complete");
      const rating = test.contexts[0].roundRatings.get("Matti");
      expect(rating).toEqual(expect.any(Number));
      expect(test.send.mock.calls.at(-1)?.[0]).toContain(`| rating ${rating}</blockquote>`);
    });

    it("still publishes when fetching the course data fails", async () => {
      const test = harness();
      test.fetchCourse.mockRejectedValue(new Error("Metrix down"));
      test.observe(input());
      test.observe(input([score(3), [], [], []]));
      await test.session.idle();
      expect(test.send).toHaveBeenCalledTimes(1);
      expect(test.contexts[0]).toMatchObject({ holeFacts: null, courseDifficulty: null });
      expect(test.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Metrix down" }));
    });

    it("stops waiting for course data that never arrives", async () => {
      vi.useFakeTimers();
      try {
        const test = harness();
        test.fetchCourse.mockReturnValue(new Promise(() => undefined));
        test.observe(input());
        test.observe(input([score(3), [], [], []]));
        await vi.advanceTimersByTimeAsync(15_000);
        await test.session.idle();
        expect(test.send).toHaveBeenCalledTimes(1);
        expect(test.contexts[0].holeFacts).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("loads weather and course data side by side and stops waiting for weather that never arrives", async () => {
      vi.useFakeTimers();
      try {
        const test = harness();
        test.fetchWeather.mockReturnValue(new Promise(() => undefined));
        test.fetchCourse.mockResolvedValue({ details: layout, statistics: null });
        test.observe(input());
        test.observe(input([score(3), [], [], []]));
        await vi.advanceTimersByTimeAsync(15_000);
        await test.session.idle();
        expect(test.send).toHaveBeenCalledTimes(1);
        expect(test.contexts[0]).toMatchObject({ weather: null, holeFacts: "Väylä 1: Par 3, 57 m, radan lyhyin." });
        expect(test.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Weather not available within 15000 ms" }));
      } finally {
        vi.useRealTimers();
      }
    });

    it("drops course facts, not the message, when they can't be composed", async () => {
      const test = harness();
      // Deliberately malformed: course data that slipped past validation must not cost the update its message.
      const broken = { details: { ...layout, holes: null }, statistics: null } as unknown as Awaited<ReturnType<CommentaryDelivery["fetchCourse"]>>;
      test.fetchCourse.mockResolvedValue(broken);
      test.observe(input());
      test.observe(input([score(3), [], [], []]));
      await test.session.idle();
      expect(test.send).toHaveBeenCalledTimes(1);
      expect(test.contexts[0].holeFacts).toBeNull();
      expect(test.onError).toHaveBeenCalledTimes(1);
    });
  });

  it("stops queued delivery on stop", async () => {
    const test = harness();
    test.observe(input());
    test.observe(input([score(3), [], [], []]));
    test.session.stop();
    await test.session.idle();
    expect(test.send).not.toHaveBeenCalled();
  });

  it("escapes and splits long batch messages at block boundaries within the Telegram limit", () => {
    const brief: FactualCommentaryBrief = {
      playerName: "Matti", courseName: "Testirata", division: "MA3", event: "scores-recorded",
      changes: [{ kind: "recorded", holeNumber: 1, score: { strokes: 3, relativeToPar: 0, obCount: null } }],
      round: { progress: { kind: "unknown" }, recordedStrokes: 3, recordedRelativeToPar: 0, scores: null },
      standing: { position: null, fieldSize: null, isProvisional: true }, movementSincePublication: { kind: "unknown" }, limitations: [],
    };
    const post = { brief, text: `<Matti> & ${"😀".repeat(4000)}` };
    const messages = formatBatchCommentaryMessages("Avaus & alku", [post], "Loppu", "123", new Map());
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every(message => message.html.length <= TELEGRAM_MESSAGE_LIMIT)).toBe(true);
    expect(messages[0].html).toContain("🎙️ <i>Avaus &amp; alku</i>");
    expect(messages.flatMap(message => message.posts)).toEqual([post]);
    expect(messages.at(-1)?.html).toContain("📊 Loppu");
  });
});
