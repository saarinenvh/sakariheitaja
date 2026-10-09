import { describe, it, expect, vi, beforeEach } from "vitest";
import { HoleScore, Scorecard } from "../../../integrations/metrix/round/types";

// Mocked so this exercises which rows get written, without a database.
vi.mock("../db/specialScoreRepository", () => ({
  syncSpecialScores: vi.fn(async () => undefined),
}));
vi.mock("../db/scoreRepository", () => ({
  addResult: vi.fn(),
  findResultPlayerIds: vi.fn(async () => [] as number[]),
  findCoursesWithResults: vi.fn(async () => []),
  findCourseResults: vi.fn(async () => []),
}));
vi.mock("../db/courseRepository", () => ({
  addIfAbsent: vi.fn(async () => undefined),
  findByName: vi.fn(async () => ({ id: 7, name: "Talin frisbeegolfrata" })),
  findById: vi.fn(async () => null),
}));

import * as scoreRepo from "../db/scoreRepository";
import * as specialScoreRepo from "../db/specialScoreRepository";
import * as courseRepo from "../db/courseRepository";
import { findCourseResults, saveResults, syncSpecialScores } from "../scoreRecords";
import { specialScoreDate } from "../policy";

const hole = (strokes: number, relativeToPar: number): HoleScore => ({ strokes, relativeToPar, obCount: 0 });
const card = (...holes: (HoleScore | null)[]): Scorecard => ({ kind: "available", holes });
const round = { playerId: 42, chatId: -100, competitionId: 55 };
const played = { courseName: "Talin frisbeegolfrata", day: "2026-10-03" };
const now = new Date(2026, 9, 5, 12, 0);
const sync = (scorecard: Scorecard) => syncSpecialScores(round, played, scorecard, now);

beforeEach(() => vi.clearAllMocks());

describe("syncSpecialScores", () => {
  it("syncs the card's special scores of every kind, numbering holes by their place on the card", async () => {
    await sync(card(hole(2, -1), hole(1, -2), hole(2, -2), hole(2, -3), null));

    expect(specialScoreRepo.syncSpecialScores).toHaveBeenCalledWith(round, {
      courseId: 7, date: "2026-10-03",
      scores: [{ holeNumber: 2, kind: "ace" }, { holeNumber: 3, kind: "eagle" }, { holeNumber: 4, kind: "albatross" }],
    });
  });

  it("syncs to none, touching no course, when the card has no special scores", async () => {
    await sync(card(hole(2, -1), null));

    expect(specialScoreRepo.syncSpecialScores).toHaveBeenCalledWith(round, null);
    expect(courseRepo.addIfAbsent).not.toHaveBeenCalled();
  });

  it("leaves the saved special scores alone when the card is unavailable", async () => {
    await sync({ kind: "unavailable" });

    expect(specialScoreRepo.syncSpecialScores).not.toHaveBeenCalled();
  });

  it("dates a round without a day with the given time's date", async () => {
    await syncSpecialScores(round, { ...played, day: null }, card(hole(1, -2)), now);

    expect(specialScoreRepo.syncSpecialScores).toHaveBeenCalledWith(round, expect.objectContaining({ date: "2026-10-05" }));
  });

  it("adds a course the bot hasn't seen before instead of dropping the score", async () => {
    let courseExists = false;
    vi.mocked(courseRepo.addIfAbsent).mockImplementationOnce(async () => {
      courseExists = true;
    });
    vi.mocked(courseRepo.findByName).mockImplementationOnce(async name => (courseExists ? { id: 8, name } : null));

    await sync(card(hole(1, -2)));

    expect(courseRepo.addIfAbsent).toHaveBeenCalledWith("Talin frisbeegolfrata");
    expect(specialScoreRepo.syncSpecialScores).toHaveBeenCalledWith(round, expect.objectContaining({ courseId: 8 }));
  });
});

describe("specialScoreDate", () => {
  const lateEvening = new Date(2026, 9, 5, 23, 30);

  it("dates a special score with the round's day, not the day it is saved on", () => {
    expect(specialScoreDate("2026-10-03", lateEvening)).toBe("2026-10-03");
  });

  it("falls back to today's local date for a round without a real date", () => {
    expect(specialScoreDate(null, lateEvening)).toBe("2026-10-05");
  });
});

describe("saveResults", () => {
  it("skips players whose result for the competition is already saved, so a retried round end saves once", async () => {
    vi.mocked(scoreRepo.findResultPlayerIds).mockResolvedValueOnce([1]);
    await saveResults([
      { playerId: 1, strokes: 54, relativeToPar: 0 },
      { playerId: 2, strokes: 57, relativeToPar: 3 },
    ], -100, 7, 55);
    expect(scoreRepo.findResultPlayerIds).toHaveBeenCalledWith(55);
    expect(scoreRepo.addResult).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addResult).toHaveBeenCalledWith({ playerId: 2, chatId: -100, courseId: 7, competitionId: 55, relativeToPar: 3, strokes: 57 });
  });

  it("saves a player at most once even if the batch repeats them", async () => {
    await saveResults([
      { playerId: 3, strokes: 54, relativeToPar: 0 },
      { playerId: 3, strokes: 54, relativeToPar: 0 },
    ], -100, 7, 55);
    expect(scoreRepo.addResult).toHaveBeenCalledTimes(1);
  });
});

describe("findCourseResults", () => {
  const kaatis = { id: 7, name: "Kaatis" };

  it("takes a number as a course id", async () => {
    vi.mocked(courseRepo.findById).mockResolvedValueOnce(kaatis);

    await expect(findCourseResults(-100, "7")).resolves.toEqual({ kind: "results", course: "Kaatis", results: [] });
    expect(scoreRepo.findCourseResults).toHaveBeenCalledWith(-100, 7);
    expect(scoreRepo.findCoursesWithResults).not.toHaveBeenCalled();
  });

  it("reports an unknown course id as not found", async () => {
    await expect(findCourseResults(-100, "99")).resolves.toEqual({ kind: "not-found" });
  });

  it("uses the one course of the chat whose name matches", async () => {
    vi.mocked(scoreRepo.findCoursesWithResults).mockResolvedValueOnce([kaatis]);

    await expect(findCourseResults(-100, "kaat")).resolves.toMatchObject({ kind: "results", course: "Kaatis" });
    expect(scoreRepo.findCoursesWithResults).toHaveBeenCalledWith(-100, "kaat");
  });

  it("lists the courses with their ids when several match, and reports none matching", async () => {
    vi.mocked(scoreRepo.findCoursesWithResults).mockResolvedValueOnce([kaatis, { id: 8, name: "Kaatis B" }]);

    await expect(findCourseResults(-100, "kaatis")).resolves.toEqual({ kind: "ambiguous-course", courses: [kaatis, { id: 8, name: "Kaatis B" }] });
    await expect(findCourseResults(-100, "jokin")).resolves.toEqual({ kind: "not-found" });
  });
});
