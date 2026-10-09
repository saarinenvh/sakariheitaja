import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoreThanOrEqual } from "typeorm";

type Call = { operation: string; entity: string; argument: unknown };
const recorded = vi.hoisted(() => ({ calls: [] as Call[], foundRecords: [] as unknown[] }));

// Records what reaches TypeORM, so this runs without a database.
vi.mock("../../../../db/dataSource", () => ({
  dataSource: {
    getRepository: (entity: { name: string }) => ({
      find: async (options: unknown) => {
        recorded.calls.push({ operation: "find", entity: entity.name, argument: options });
        return recorded.foundRecords;
      },
    }),
  },
}));

import { findSpecialScores } from "../specialScoreRepository";

const savedAce = { date: "2026-10-05", playerId: 42, chatId: -100, courseId: 7, competitionId: 55, holeNumber: 6 };

beforeEach(() => {
  recorded.calls.length = 0;
  recorded.foundRecords = [];
});

// syncSpecialScores is covered against MariaDB, in tests/integration/tests/specialScores.test.ts.

describe("findSpecialScores", () => {
  it("reads the chat's rows of that kind with each filter that is set, newest first", async () => {
    recorded.foundRecords = [{ ...savedAce, id: 1, holeNumber: 7, player: { name: "Matti" }, course: { name: "Kaatis" } }];

    const rows = await findSpecialScores("eagle", -100, { sinceDate: "2026-01-01", courseId: 3, playerId: null });

    expect(recorded.calls).toEqual([{
      operation: "find", entity: "Eagle",
      argument: {
        where: { chatId: -100, date: MoreThanOrEqual("2026-01-01"), courseId: 3 },
        relations: { player: true, course: true }, order: { date: "DESC", id: "DESC" },
      },
    }]);
    expect(rows).toEqual([{ player: "Matti", course: "Kaatis", holeNumber: 7, date: "2026-10-05" }]);
  });
});
