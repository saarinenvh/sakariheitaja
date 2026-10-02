import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScoreChange } from "../commentary/detect/scorecardChanges";

// Mocked so this exercises which rows get written, without a database.
vi.mock("../../../db/repositories/ScoreRepository", () => ({
  addAce: vi.fn(),
  addEagle: vi.fn(),
  addAlbatross: vi.fn(),
  addResult: vi.fn(),
}));
vi.mock("../../../db/repositories/CourseRepository", () => ({
  findByName: vi.fn(async () => ({ id: 7, name: "Talin frisbeegolfrata" })),
}));

import * as scoreRepo from "../../../db/repositories/ScoreRepository";
import { saveRecordedScores } from "./ScoreService";

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
});
