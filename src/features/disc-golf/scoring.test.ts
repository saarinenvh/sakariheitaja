import { describe, it, expect, vi, beforeEach } from "vitest";
import { Change, MetrixHoleResult } from "../../types/metrix";

// Mocked so this exercises which rows get written, without a database.
vi.mock("../../db/repositories/ScoreRepository", () => ({
  addAce: vi.fn(),
  addEagle: vi.fn(),
  addAlbatross: vi.fn(),
  addResult: vi.fn(),
}));
vi.mock("../../db/repositories/CourseRepository", () => ({
  findByName: vi.fn(async () => ({ id: 7, name: "Talin frisbeegolfrata" })),
}));

import * as scoreRepo from "../../db/repositories/ScoreRepository";
import { saveSuperScore } from "./services/ScoreService";

const H = (Result: string, Diff: number): MetrixHoleResult => ({ Result, Diff, PEN: 0 });

function change(hole: number, holeResult: MetrixHoleResult, earlierHoles?: { hole: number; holeResult: MetrixHoleResult }[]): Change {
  const player = { Name: "Matti", ClassName: "MPO", OrderNumber: 1, Diff: 0, Sum: 54 };
  return { playerName: "Matti", playerId: 42, prevPlayer: player, newPlayer: player, hole, holeResult, earlierHoles };
}

beforeEach(() => vi.clearAllMocks());

describe("saveSuperScore", () => {
  it("records an ace that was entered alongside later holes", async () => {
    // A scorekeeper enters holes 2, 3 and 4 in one go. Only hole 4 is
    // commentated - but hole 3 was an ace, and it still happened.
    await saveSuperScore(
      change(3, H("5", 2), [
        { hole: 1, holeResult: H("2", -1) },   // birdie, not notable
        { hole: 2, holeResult: H("1", -2) },   // ACE
      ]),
      -100, 55, "Talin frisbeegolfrata",
    );

    expect(scoreRepo.addAce).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAce).toHaveBeenCalledWith(expect.any(String), 42, -100, 7, 55);
    expect(scoreRepo.addEagle).not.toHaveBeenCalled();
  });

  it("records every notable score in the batch, not just one", async () => {
    await saveSuperScore(
      change(3, H("1", -2), [
        { hole: 1, holeResult: H("2", -2) },   // eagle
        { hole: 2, holeResult: H("2", -3) },   // albatross
      ]),
      -100, 55, "Talin frisbeegolfrata",
    );

    expect(scoreRepo.addEagle).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAlbatross).toHaveBeenCalledTimes(1);
    expect(scoreRepo.addAce).toHaveBeenCalledTimes(1);   // the commentated hole
  });

  it("still records a notable score on the commentated hole alone", async () => {
    await saveSuperScore(change(5, H("1", -2)), -100, 55, "Talin frisbeegolfrata");
    expect(scoreRepo.addAce).toHaveBeenCalledTimes(1);
  });

  it("writes nothing for an ordinary batch of holes", async () => {
    await saveSuperScore(
      change(3, H("4", 1), [{ hole: 1, holeResult: H("3", 0) }, { hole: 2, holeResult: H("4", 1) }]),
      -100, 55, "Talin frisbeegolfrata",
    );

    expect(scoreRepo.addAce).not.toHaveBeenCalled();
    expect(scoreRepo.addEagle).not.toHaveBeenCalled();
    expect(scoreRepo.addAlbatross).not.toHaveBeenCalled();
  });
});
