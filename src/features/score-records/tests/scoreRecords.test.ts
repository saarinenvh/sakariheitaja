import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScoreChange } from "../../commentary";

// Mocked so this exercises which rows get written, without a database.
vi.mock("../db/scoreRepository", () => ({
  addAce: vi.fn(),
  addEagle: vi.fn(),
  addAlbatross: vi.fn(),
  addResult: vi.fn(),
  findResultPlayerIds: vi.fn(async () => [] as number[]),
}));
vi.mock("../db/courseRepository", () => ({
  upsert: vi.fn(async () => undefined),
  findByName: vi.fn(async () => ({ id: 7, name: "Talin frisbeegolfrata" })),
}));

import * as scoreRepo from "../db/scoreRepository";
import * as courseRepo from "../db/courseRepository";
import { saveRecordedScores, saveResults } from "../scoreRecords";

const recorded = (holeNumber: number, strokes: number, relativeToPar: number): ScoreChange =>
  ({ kind: "recorded", holeNumber, score: { strokes, relativeToPar, obCount: 0 } });

const save = (changes: ScoreChange[]) => saveRecordedScores(42, changes, -100, 55, "Talin frisbeegolfrata");

beforeEach(() => vi.clearAllMocks());

describe("saveRecordedScores", () => {
  it("records an ace that was entered alongside other holes", async () => {
    // A scorekeeper enters holes 1-3 in one go; the ace on hole 2 still happened.
    await save([recorded(1, 2, -1), recorded(2, 1, -2), recorded(3, 5, 2)]);
    expect(scoreRepo.addAce).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAce).toHaveBeenCalledWith(expect.any(String), 42, -100, 7, 55);
    expect(scoreRepo.addEagle).not.toHaveBeenCalled();
  });

  it("records every notable score in the batch, not just one", async () => {
    await save([recorded(1, 2, -2), recorded(2, 2, -3), recorded(3, 1, -2)]);
    expect(scoreRepo.addEagle).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAlbatross).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAce).toHaveBeenCalledTimes(1);
  });

  it("writes nothing for ordinary holes or for corrections", async () => {
    const correctedToAce: ScoreChange = {
      kind: "corrected", holeNumber: 2,
      previous: { strokes: 2, relativeToPar: -1, obCount: 0 }, current: { strokes: 1, relativeToPar: -2, obCount: 0 },
    };
    await save([recorded(1, 3, 0), correctedToAce, recorded(3, 4, 1)]);
    expect(scoreRepo.addAce).not.toHaveBeenCalled();
    expect(scoreRepo.addEagle).not.toHaveBeenCalled();
    expect(scoreRepo.addAlbatross).not.toHaveBeenCalled();
  });

  it("adds a course the bot hasn't seen before instead of dropping the score", async () => {
    let courseExists = false;
    vi.mocked(courseRepo.upsert).mockImplementationOnce(async () => {
      courseExists = true;
    });
    vi.mocked(courseRepo.findByName).mockImplementationOnce(async name => (courseExists ? { id: 8, name } : null));
    await save([recorded(1, 1, -2)]);
    expect(courseRepo.upsert).toHaveBeenCalledWith("Talin frisbeegolfrata");
    expect(scoreRepo.addAce).toHaveBeenCalledWith(expect.any(String), 42, -100, 8, 55);
  });

  it("touches no course for ordinary holes", async () => {
    await save([recorded(1, 3, 0)]);
    expect(courseRepo.upsert).not.toHaveBeenCalled();
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
    expect(scoreRepo.addResult).toHaveBeenCalledWith(2, -100, 7, 55, 3, 57);
  });

  it("saves a player at most once even if the batch repeats them", async () => {
    await saveResults([
      { playerId: 3, strokes: 54, relativeToPar: 0 },
      { playerId: 3, strokes: 54, relativeToPar: 0 },
    ], -100, 7, 55);
    expect(scoreRepo.addResult).toHaveBeenCalledTimes(1);
  });
});
