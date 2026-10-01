import { describe, expect, it } from "vitest";
import { parseMetrixRound } from "../../src/features/disc-golf/metrix/metrixRound";
import { buildAnonymizedFixture, buildFakeNames } from "./anonymize";
import { countSentences, runChecks } from "./checks";
import { parseHoleRange } from "./cliFlags";
import { CommentaryFixture } from "./fixtureFile";
import { buildReplaySteps, REPLAY_ROUND_ID } from "./replay";
import { BatchCommentaryContext } from "../../src/features/disc-golf/commentary/writer/commentaryContext";
import { FactualCommentaryBrief } from "../../src/features/disc-golf/commentary/facts/playerBrief";

const hole = (Result: number, Diff: number, PEN = 0) => ({ Result, Diff, PEN });

const metrixResponse = {
  Competition: {
    CourseName: "Testirata", Date: "2026-05-23",
    Tracks: [1, 2, 3].map(Number => ({ Number, NumberAlt: "", Par: 3 })),
    Results: [
      { Name: "Ville Saarinen", ClassName: "", Group: "1", UserID: "77", Sum: 8, PlayerResults: [hole(2, -1), hole(3, 0), hole(3, 0)] },
      { Name: "Ville Liedes", ClassName: "", Group: "1", UserID: "78", PlayerResults: [hole(3, 0), hole(4, 1, 1), hole(2, -1)] },
      { Name: "teppo", ClassName: "", Group: "1", PlayerResults: [hole(3, 0), [], []] },
    ],
  },
};

describe("fixture anonymization", () => {
  it("keeps first-name collisions and letter case while replacing every name", () => {
    const names = buildFakeNames(["Ville Saarinen", "Ville Liedes", "teppo"]);
    expect([...names.values()]).toEqual(["Aatu Ahonen", "Aatu Heikkilä", "eero"]);
  });

  it("maps tracked players, drops personal fields and rejects unknown tracked names", () => {
    const fixture = buildAnonymizedFixture(metrixResponse, { name: "test", description: "d", trackedRealNames: ["Ville Liedes"], course: null });
    expect(fixture.tracked).toEqual(["Aatu Heikkilä"]);
    expect(Object.keys(fixture.players[0]).sort()).toEqual(["ClassName", "DNF", "Group", "Name", "PlayerResults"]);
    expect(JSON.stringify(fixture)).not.toMatch(/Saarinen|Liedes|teppo|"77"/);
    expect(() => buildAnonymizedFixture(metrixResponse, { name: "t", description: "d", trackedRealNames: ["Nobody"], course: null }))
      .toThrow("Nobody");
  });
});

describe("hole range flag", () => {
  it("parses single holes and ranges, and treats an absent flag as every hole", () => {
    expect(parseHoleRange(undefined)).toBeNull();
    expect(parseHoleRange("5")).toEqual({ first: 5, last: 5 });
    expect(parseHoleRange("3-8")).toEqual({ first: 3, last: 8 });
  });

  it("rejects a flag without a value or an empty range instead of running every hole", () => {
    expect(() => parseHoleRange("")).toThrow("--holes must look like");
    expect(() => parseHoleRange("8-3")).toThrow("is empty");
  });
});

describe("round replay", () => {
  const fixture: CommentaryFixture = buildAnonymizedFixture(metrixResponse, {
    name: "test", description: "d", trackedRealNames: ["Ville Saarinen", "Ville Liedes"], course: null,
  });

  it("keeps an OB reported in the OB field rather than PEN", () => {
    const withObField = { Competition: { ...metrixResponse.Competition, Results: [
      { Name: "Ville Saarinen", ClassName: "", Group: "1", PlayerResults: [{ Result: 4, Diff: 1, OB: 1 }, [], []] },
    ] } };
    const obFixture = buildAnonymizedFixture(withObField, { name: "ob", description: "d", trackedRealNames: ["Ville Saarinen"], course: null });
    const round = parseMetrixRound(buildReplaySteps(obFixture)[1].payload, REPLAY_ROUND_ID);
    expect(round.players[0].scorecard).toMatchObject({ kind: "available", holes: [{ strokes: 4, obCount: 1 }, null, null] });
  });

  it("cuts every card to the first holes, recomputes totals and lets the bot derive places", () => {
    const steps = buildReplaySteps(fixture);
    expect(steps.map(step => step.completedHoles)).toEqual([0, 1, 2, 3]);
    const afterTwo = parseMetrixRound(steps[2].payload, REPLAY_ROUND_ID);
    expect(afterTwo.players.map(player => [player.totalRelativeToPar, player.standing.position])).toEqual([
      [-1, 1], [1, 3], [0, 2],
    ]);
    expect(afterTwo.players[1].scorecard).toMatchObject({ kind: "available", holes: [{ strokes: 3 }, { strokes: 4, obCount: 1 }, null] });
  });
});

describe("message checks", () => {
  const brief = (overrides: Partial<FactualCommentaryBrief> = {}): FactualCommentaryBrief => ({
    playerName: "Aatu Ahonen", courseName: "Testirata", division: "", event: "scores-recorded",
    changes: [{ kind: "recorded", holeNumber: 5, holeLabel: "5", score: { strokes: 4, relativeToPar: 1, obCount: 0 } }],
    round: { progress: { kind: "observed", completedHoles: 5, totalHoles: 21 }, recordedStrokes: 15, recordedRelativeToPar: 1, scores: null },
    standing: { position: 2, fieldSize: 18, isProvisional: false }, movementSincePublication: { kind: "unknown" }, limitations: [],
    ...overrides,
  });
  const context = (players: FactualCommentaryBrief[]): BatchCommentaryContext => ({
    players, standings: [], scorecardTable: null, playOrderKnown: true, leadHistory: null, weather: null, recentMessages: [],
    firstMessage: false, holeFacts: null, courseDifficulty: null, roundRatings: new Map(),
    spokenNames: new Map([["Aatu Ahonen", "Aatu"]]),
  });
  const generated = (opening: string, text: string, closing: string, players = [brief()]) => ({
    context: context(players), rawReply: null,
    result: { kind: "generated" as const, commentary: { opening, closing, lines: players.map(player => ({ brief: player, text })) } },
  });

  const problems = (batch: Parameters<typeof runChecks>[0]) => runChecks(batch).filter(finding => finding.severity !== "info");

  it("notes lines that start with the player's name or don't mention it", () => {
    const info = (text: string) => runChecks(generated("Alku.", text, "Loppu.")).filter(finding => finding.severity === "info")
      .map(finding => finding.check);
    expect(info("Aatu heitti parin.")).toEqual(["name-first"]);
    expect(info("Puuosuma ja silti pari, Aatu.")).toEqual([]);
    expect(info("Puuosuma ja silti pari.")).toEqual(["name-missing"]);
  });

  it("flags invented OB, unsupported movement, wrong hole numbers and ball-golf verbs", () => {
    const findings = problems(generated("Väylällä 6 tuulee.", "Aatu lyönti meni outtiin ja nousi kärkeen.", "Tasaista."));
    expect(findings.map(finding => finding.check).sort()).toEqual(["false-ob", "golf-verb", "unsupported-movement", "wrong-hole", "wrong-place"]);
  });

  it("doesn't read a par as a hole number", () => {
    expect(runChecks(generated("Väylällä 5 odottaa radan vaikein par-3 väylä, ja par 4 väylät tulee perässä.", "Aatu heitti.", "Loppu.", [
      brief({ changes: [{ kind: "recorded", holeNumber: 5, holeLabel: "5", score: { strokes: 3, relativeToPar: 0, obCount: 0 } }] }),
    ])).filter(finding => finding.check === "wrong-hole")).toEqual([]);
  });

  it("accepts a real OB, the right hole and known movement without findings", () => {
    const withOb = brief({
      changes: [{ kind: "recorded", holeNumber: 5, holeLabel: "5", score: { strokes: 5, relativeToPar: 2, obCount: 1 } }],
      movementSincePublication: { kind: "down", previousPosition: 1, currentPosition: 2, places: 1 },
    });
    expect(problems(generated("Väylä 5 odottaa.", "Aatu heitti OB:n ja putosi kakkoseksi.", "Kärki vaihtui.", [withOb]))).toEqual([]);
  });

  it("warns about place and lead claims that contradict the player's position, and accepts correct ones", () => {
    const second = brief({ standing: { position: 2, fieldSize: 18, isProvisional: false } });
    const claims = (text: string) => runChecks(generated("Alku.", text, "Loppu.", [second]))
      .filter(finding => finding.check === "wrong-place").map(finding => finding.detail);
    expect(claims("Aatu nousi kolmannelle sijalle.")).toEqual(["Aatu: says 3, is 2"]);
    expect(claims("Aatu kiipesi sijalle 4.")).toEqual(["Aatu: says 4, is 2"]);
    expect(claims("Aatu on nyt kärjessä.")).toEqual(["Aatu: \"kärjessä\", is 2"]);
    expect(claims("Aatu on kakkosena ja toisella sijalla.")).toEqual([]);
    expect(claims("Aatu teki bogin kolmosella.")).toEqual([]);
  });

  it("notices a result label at the start of a value in the raw JSON reply", () => {
    const batch = { ...generated("Alku.", "Aatu heitti.", "Loppu."), rawReply: '{"opening":"Tulos: par","players":[],"closing":"x"}' };
    expect(runChecks(batch).map(finding => finding.check)).toContain("result-label");
  });

  it("fails a published ordinary rating and accepts an exceptional one", () => {
    const rated = (text: string) => {
      const batch = generated("Alku.", text, "Loppu.");
      return runChecks({ ...batch, context: { ...batch.context, roundRatings: new Map([["Aatu Ahonen", 962]]) } })
        .filter(finding => finding.check === "ordinary-rating").map(finding => finding.detail);
    };
    expect(rated("Aatu veti 962 ratingin kierroksen.")).toEqual(["mentions 962"]);
    expect(rated("Aatu, ratingilla noin 900 ei juhlita.")).toEqual(["mentions 900"]);
    expect(rated("Aatu, rating 1004, TONNIN RUNDI!")).toEqual([]);
    expect(rated("Aatu heitti 96 metriä.")).toEqual([]);
    // An invented rating counts whichever side of the word it is on.
    expect(rated("Aatu veti 900 ratingin kierroksen.")).toEqual(["mentions 900"]);
  });

  it("doesn't take the course's par-rating for a round rating", () => {
    const parRating = (text: string) => runChecks(generated("Alku.", text, "Loppu."))
      .filter(finding => finding.check === "ordinary-rating");
    expect(parRating("Radan par-rating noin 935, Aatu.")).toEqual([]);
    expect(parRating("935 par-ratingin rata ei armahda Aatua.")).toEqual([]);
  });

  it("counts sentences and comparisons and reports fallbacks", () => {
    expect(countSentences("Yksi. Kaksi! Kolme? HAHAHAA")).toBe(4);
    const twoComparisons = generated("Alku.", "Aatu on kuin juna, kuin raketti.", "Loppu.");
    expect(problems(twoComparisons).map(finding => finding.check)).toEqual(["comparison-count"]);
    const fallback = { context: context([brief()]), rawReply: null,
      result: { kind: "fallback" as const, reason: "unusable-response" as const, commentary: { opening: "", closing: "", lines: [] } } };
    expect(runChecks(fallback)).toEqual([{ check: "fallback", severity: "fail", detail: "unusable-response" }]);
  });
});
