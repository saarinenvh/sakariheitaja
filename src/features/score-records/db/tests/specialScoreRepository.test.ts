import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoreThanOrEqual } from "typeorm";

type Call = { operation: string; entity: string; argument: unknown; inTransaction: boolean };
const recorded = vi.hoisted(() => ({ calls: [] as Call[], foundRecords: [] as unknown[] }));

function recordingManager(inTransaction: boolean) {
  const record = (operation: string, entity: { name: string }, argument: unknown) =>
    recorded.calls.push({ operation, entity: entity.name, argument, inTransaction });

  return {
    delete: async (entity: { name: string }, criteria: unknown) => record("delete", entity, criteria),
    createQueryBuilder: () => {
      const insert = { entity: { name: "" }, values: [] as unknown };
      const builder = {
        insert: () => builder,
        into: (entity: { name: string }) => { insert.entity = entity; return builder; },
        values: (values: unknown) => { insert.values = values; return builder; },
        orIgnore: () => builder,
        execute: async () => record("insert or ignore", insert.entity, insert.values),
      };
      return builder;
    },
  };
}

// Records what reaches TypeORM, inside or outside the transaction, so this runs without a database.
vi.mock("../../../../db/dataSource", () => ({
  dataSource: {
    manager: recordingManager(false),
    transaction: async (work: (manager: unknown) => Promise<void>) => work(recordingManager(true)),
    getRepository: (entity: { name: string }) => ({
      find: async (options: unknown) => {
        recorded.calls.push({ operation: "find", entity: entity.name, argument: options, inTransaction: false });
        return recorded.foundRecords;
      },
    }),
  },
}));

import { addSpecialScores, findSpecialScores, rebuildSpecialScores } from "../specialScoreRepository";

const round = { playerId: 42, chatId: -100, competitionId: 55 };
const aceOnSix = { courseId: 7, date: "2026-10-05", scores: [{ holeNumber: 6, kind: "ace" as const }] };
const savedAce = { date: "2026-10-05", playerId: 42, chatId: -100, courseId: 7, competitionId: 55, holeNumber: 6 };

beforeEach(() => {
  recorded.calls.length = 0;
  recorded.foundRecords = [];
});

describe("addSpecialScores", () => {
  it("inserts each score with INSERT IGNORE, without deleting anything", async () => {
    await addSpecialScores(round, aceOnSix);
    expect(recorded.calls).toEqual([{ operation: "insert or ignore", entity: "Ace", argument: [savedAce], inTransaction: false }]);
  });
});

describe("rebuildSpecialScores", () => {
  it("deletes the player's special scores in the round, then inserts the card's, in one transaction", async () => {
    await rebuildSpecialScores(round, aceOnSix);
    expect(recorded.calls).toEqual([
      ...["Ace", "Eagle", "Albatross"].map(entity => ({
        operation: "delete", entity, argument: { competitionId: 55, playerId: 42 }, inTransaction: true,
      })),
      { operation: "insert or ignore", entity: "Ace", argument: [savedAce], inTransaction: true },
    ]);
  });

  it("only deletes when the card has no special scores left", async () => {
    await rebuildSpecialScores(round, null);
    expect(recorded.calls.map(call => call.operation)).toEqual(["delete", "delete", "delete"]);
  });
});

describe("findSpecialScores", () => {
  it("reads the chat's rows of that kind with each filter that is set, newest first", async () => {
    recorded.foundRecords = [{ ...savedAce, id: 1, holeNumber: 7, player: { name: "Matti" }, course: { name: "Kaatis" } }];

    const rows = await findSpecialScores("eagle", -100, { sinceDate: "2026-01-01", courseId: 3, playerId: null });

    expect(recorded.calls).toEqual([{
      operation: "find", entity: "Eagle", inTransaction: false,
      argument: {
        where: { chatId: -100, date: MoreThanOrEqual("2026-01-01"), courseId: 3 },
        relations: { player: true, course: true }, order: { date: "DESC", id: "DESC" },
      },
    }]);
    expect(rows).toEqual([{ player: "Matti", course: "Kaatis", holeNumber: 7, date: "2026-10-05" }]);
  });
});
