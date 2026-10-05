import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this exercises how the report resolves what it was asked, without a database.
vi.mock("../db/specialScoreRepository", () => ({ findSpecialScores: vi.fn(async () => []) }));
vi.mock("../db/courseRepository", () => ({ findById: vi.fn(async () => null), searchByName: vi.fn(async () => []) }));
vi.mock("../../players", () => ({ getGroupPlayers: vi.fn(async () => []), Player: class Player {} }));

import * as specialScoreRepo from "../db/specialScoreRepository";
import * as courseRepo from "../db/courseRepository";
import { getGroupPlayers } from "../../players";
import { buildSpecialScoreReport } from "../specialScoreReport";
import { summarizeSpecialScores } from "../policy";

const thisYear = { kind: "year", year: 2026 } as const;
const report = (query: string | null, period: { kind: "year"; year: number } | { kind: "alltime" } = thisYear) =>
  buildSpecialScoreReport({ kind: "ace", chatId: -100, period, query });
const course = (id: number, name: string) => ({ id, name });
const filter = () => vi.mocked(specialScoreRepo.findSpecialScores).mock.calls[0][2];

beforeEach(() => vi.clearAllMocks());

describe("buildSpecialScoreReport", () => {
  it("reads the whole chat's scores from the start of the year", async () => {
    await expect(report(null)).resolves.toMatchObject({ kind: "report", subject: { kind: "chat" } });
    expect(specialScoreRepo.findSpecialScores).toHaveBeenCalledWith("ace", -100, { sinceDate: "2026-01-01", courseId: null, playerId: null });
  });

  it("reads every year with alltime", async () => {
    await report(null, { kind: "alltime" });
    expect(filter().sinceDate).toBeNull();
  });

  it("takes a number as a course id", async () => {
    vi.mocked(courseRepo.findById).mockResolvedValueOnce(course(12, "Kaatis"));
    await expect(report("12")).resolves.toMatchObject({ subject: { kind: "course", name: "Kaatis" } });
    expect(filter().courseId).toBe(12);
    expect(courseRepo.searchByName).not.toHaveBeenCalled();
  });

  it("reports an unknown course id as not found", async () => {
    await expect(report("99")).resolves.toEqual({ kind: "not-found", query: "99" });
  });

  it("uses the one course whose name matches", async () => {
    vi.mocked(courseRepo.searchByName).mockResolvedValueOnce([course(3, "Talin frisbeegolfrata")]);
    await report("talin");
    expect(filter().courseId).toBe(3);
    expect(getGroupPlayers).not.toHaveBeenCalled();
  });

  it("lists the courses with their ids when several match", async () => {
    vi.mocked(courseRepo.searchByName).mockResolvedValueOnce([course(3, "Kaatis A"), course(4, "Kaatis B")]);
    await expect(report("kaatis")).resolves.toEqual({ kind: "ambiguous-course", courses: [course(3, "Kaatis A"), course(4, "Kaatis B")] });
    expect(specialScoreRepo.findSpecialScores).not.toHaveBeenCalled();
  });

  it("looks for a player of the chat when no course matches, an exact name first", async () => {
    vi.mocked(getGroupPlayers).mockResolvedValueOnce([{ id: 1, name: "Matti" }, { id: 2, name: "Mattila" }]);
    await expect(report("matti")).resolves.toMatchObject({ subject: { kind: "player", name: "Matti" } });
    expect(getGroupPlayers).toHaveBeenCalledWith(-100);
    expect(filter().playerId).toBe(1);
  });

  it("lists the players when several partly match", async () => {
    vi.mocked(getGroupPlayers).mockResolvedValueOnce([{ id: 1, name: "Matti" }, { id: 2, name: "Mattila" }]);
    await expect(report("matt")).resolves.toEqual({ kind: "ambiguous-player", players: ["Matti", "Mattila"] });
  });

  it("reports text matching no course or player as not found", async () => {
    await expect(report("jori")).resolves.toEqual({ kind: "not-found", query: "jori" });
  });
});

describe("summarizeSpecialScores", () => {
  it("counts per player, most first and ties by name, and keeps the five latest", () => {
    const rows = ["Jori", "Matti", "Jori", "Aino", "Matti", "Jori", "Pekka"].map((player, index) => ({ player, index }));
    const summary = summarizeSpecialScores(rows);
    expect(summary.leaderboard).toEqual([
      { player: "Jori", count: 3 }, { player: "Matti", count: 2 }, { player: "Aino", count: 1 }, { player: "Pekka", count: 1 },
    ]);
    expect(summary.latest.map(row => row.index)).toEqual([0, 1, 2, 3, 4]);
  });
});
