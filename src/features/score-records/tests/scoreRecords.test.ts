import { describe, it, expect, vi, beforeEach } from "vitest";
import { HoleResult, SpecialScoreUpdate } from "../../commentary";

// Mocked so this exercises which rows get written, without a database.
vi.mock("../db/scoreRepository", () => ({
  addSpecialScores: vi.fn(async () => undefined),
  rebuildSpecialScores: vi.fn(async () => undefined),
  addResult: vi.fn(),
  findResultPlayerIds: vi.fn(async () => [] as number[]),
}));
vi.mock("../db/courseRepository", () => ({
  upsert: vi.fn(async () => undefined),
  findByName: vi.fn(async () => ({ id: 7, name: "Talin frisbeegolfrata" })),
}));

import * as scoreRepo from "../db/scoreRepository";
import * as courseRepo from "../db/courseRepository";
import { saveResults, updateSpecialScores } from "../scoreRecords";

const hole = (holeNumber: number, strokes: number, relativeToPar: number): HoleResult =>
  ({ holeNumber, score: { strokes, relativeToPar, obCount: 0 } });
const round = { playerId: 42, chatId: -100, competitionId: 55 };
const update = (kind: SpecialScoreUpdate["kind"], holes: HoleResult[]) => updateSpecialScores(round, "Talin frisbeegolfrata", { kind, holes });
const today = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/);

beforeEach(() => vi.clearAllMocks());

describe("updateSpecialScores", () => {
  it("adds the special scores among new holes, an ace that was entered with other holes included", async () => {
    // A scorekeeper enters holes 1-4 in one go; the ace on hole 2 still happened.
    await update("add", [hole(1, 2, -1), hole(2, 1, -2), hole(3, 2, -2), hole(4, 2, -3)]);
    expect(scoreRepo.addSpecialScores).toHaveBeenCalledWith(round, {
      courseId: 7, date: today,
      scores: [{ holeNumber: 2, kind: "ace" }, { holeNumber: 3, kind: "eagle" }, { holeNumber: 4, kind: "albatross" }],
    });
    expect(scoreRepo.rebuildSpecialScores).not.toHaveBeenCalled();
  });

  it("writes nothing and touches no course when no new hole is special", async () => {
    await update("add", [hole(1, 3, 0)]);
    expect(scoreRepo.addSpecialScores).not.toHaveBeenCalled();
    expect(courseRepo.upsert).not.toHaveBeenCalled();
  });

  it("rebuilds the player's special scores from a whole card", async () => {
    await update("rebuild", [hole(1, 3, 0), hole(2, 1, -2), { holeNumber: 3, score: null }]);
    expect(scoreRepo.rebuildSpecialScores).toHaveBeenCalledWith(round, { courseId: 7, date: today, scores: [{ holeNumber: 2, kind: "ace" }] });
  });

  it("rebuilds to nothing when the card has no special scores left", async () => {
    await update("rebuild", [hole(1, 2, -1), { holeNumber: 2, score: null }]);
    expect(scoreRepo.rebuildSpecialScores).toHaveBeenCalledWith(round, null);
    expect(courseRepo.upsert).not.toHaveBeenCalled();
  });

  it("adds a course the bot hasn't seen before instead of dropping the score", async () => {
    let courseExists = false;
    vi.mocked(courseRepo.upsert).mockImplementationOnce(async () => {
      courseExists = true;
    });
    vi.mocked(courseRepo.findByName).mockImplementationOnce(async name => (courseExists ? { id: 8, name } : null));
    await update("add", [hole(1, 1, -2)]);
    expect(courseRepo.upsert).toHaveBeenCalledWith("Talin frisbeegolfrata");
    expect(scoreRepo.addSpecialScores).toHaveBeenCalledWith(round, expect.objectContaining({ courseId: 8 }));
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
