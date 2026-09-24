import { describe, it, expect } from "vitest";
import { detectChanges, hasCompetitionEnded } from "./changeDetector";
import { MetrixApiResponse, TrackedPlayer } from "../../types/metrix";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeResponse(players: {
  name: string;
  sum?: number;
  diff?: number;
  holes?: ({ Result: string; Diff: number; PEN: number } | [])[];
}[]): MetrixApiResponse {
  return {
    Competition: {
      Name: "Test Cup",
      Date: "2026-03-28",
      CourseName: "Test Course",
      Results: players.map((p, i) => ({
        Name: p.name,
        Sum: p.sum,
        Diff: p.diff ?? 0,
        OrderNumber: i + 1,
        ClassName: "MPO",
        PlayerResults: p.holes ?? [],
      })),
    },
  };
}

function makeTracked(name: string, id: number): TrackedPlayer {
  return { Name: name, id, Diff: 0, OrderNumber: 1, ClassName: "MPO" };
}

// ── detectChanges ──────────────────────────────────────────────────────────────

describe("detectChanges", () => {
  it("returns empty array when no tracked players", () => {
    const data = makeResponse([{ name: "Matti", sum: 54 }]);
    expect(detectChanges(data, data, [])).toEqual([]);
  });

  it("returns empty array when Sum is unchanged", () => {
    const prev = makeResponse([{ name: "Matti", sum: 54, holes: [{ Result: "3", Diff: 0, PEN: 0 }] }]);
    const next = makeResponse([{ name: "Matti", sum: 54, holes: [{ Result: "3", Diff: 0, PEN: 0 }] }]);
    expect(detectChanges(prev, next, [makeTracked("Matti", 1)])).toEqual([]);
  });

  it("returns empty array when player has no Sum (not started)", () => {
    const prev = makeResponse([{ name: "Matti" }]);
    const next = makeResponse([{ name: "Matti" }]);
    expect(detectChanges(prev, next, [makeTracked("Matti", 1)])).toEqual([]);
  });

  it("detects a hole result change", () => {
    const prev = makeResponse([{
      name: "Matti", sum: 54,
      holes: [{ Result: "3", Diff: 0, PEN: 0 }, []],
    }]);
    const next = makeResponse([{
      name: "Matti", sum: 55,
      holes: [{ Result: "3", Diff: 0, PEN: 0 }, { Result: "4", Diff: 1, PEN: 0 }],
    }]);

    const changes = detectChanges(prev, next, [makeTracked("Matti", 1)]);
    expect(changes).toHaveLength(1);
    expect(changes[0].playerName).toBe("Matti");
    expect(changes[0].hole).toBe(1);
    expect(changes[0].holeResult).toEqual({ Result: "4", Diff: 1, PEN: 0 });
  });

  it("detects change on first hole", () => {
    const prev = makeResponse([{ name: "Matti", sum: 0, holes: [[]] }]);
    const next = makeResponse([{ name: "Matti", sum: 3, holes: [{ Result: "3", Diff: 0, PEN: 0 }] }]);

    const changes = detectChanges(prev, next, [makeTracked("Matti", 1)]);
    expect(changes).toHaveLength(1);
    expect(changes[0].hole).toBe(0);
  });

  it("only returns changes for tracked players", () => {
    const prev = makeResponse([
      { name: "Matti", sum: 54, holes: [{ Result: "3", Diff: 0, PEN: 0 }] },
      { name: "Pekka", sum: 54, holes: [{ Result: "3", Diff: 0, PEN: 0 }] },
    ]);
    const next = makeResponse([
      { name: "Matti", sum: 54, holes: [{ Result: "3", Diff: 0, PEN: 0 }] },
      { name: "Pekka", sum: 55, holes: [{ Result: "4", Diff: 1, PEN: 0 }] },
    ]);

    // Only Matti is tracked — Pekka's change should be ignored
    const changes = detectChanges(prev, next, [makeTracked("Matti", 1)]);
    expect(changes).toHaveLength(0);
  });

  it("skips player not found in results", () => {
    const data = makeResponse([{ name: "Pekka", sum: 54 }]);
    const changes = detectChanges(data, data, [makeTracked("Matti", 1)]);
    expect(changes).toHaveLength(0);
  });

  it("attaches correct playerId from tracked player", () => {
    const prev = makeResponse([{ name: "Matti", sum: 54, holes: [[]] }]);
    const next = makeResponse([{ name: "Matti", sum: 57, holes: [{ Result: "3", Diff: 0, PEN: 0 }] }]);

    const changes = detectChanges(prev, next, [makeTracked("Matti", 42)]);
    expect(changes[0].playerId).toBe(42);
  });

  it("reports only the latest hole when several appear in one poll window", () => {
    const H = (Result: string, Diff: number) => ({ Result, Diff, PEN: 0 });
    const prev = makeResponse([{ name: "Matti", sum: 3, holes: [H("3", 0), [], [], []] }]);
    const next = makeResponse([{
      name: "Matti", sum: 11,
      holes: [H("3", 0), H("2", -1), H("1", -2), H("5", 2)],
    }]);

    const changes = detectChanges(prev, next, [makeTracked("Matti", 1)]);

    // One message per player per update - about where they are now, not where
    // they were two holes ago.
    expect(changes).toHaveLength(1);
    expect(changes[0].hole).toBe(3);
    expect(changes[0].holeResult).toEqual(H("5", 2));

    // ...but the holes in between are still carried, so their scores count.
    // Hole 3 here is an ace; it used to vanish entirely.
    expect(changes[0].earlierHoles).toEqual([
      { hole: 1, holeResult: H("2", -1) },
      { hole: 2, holeResult: H("1", -2) },
    ]);
  });

  it("still reports a new hole when an earlier hole was corrected in the same window", () => {
    const H = (Result: string, Diff: number) => ({ Result, Diff, PEN: 0 });
    const prev = makeResponse([{ name: "Matti", sum: 7, holes: [H("4", 1), H("3", 0), []] }]);
    const next = makeResponse([{ name: "Matti", sum: 9, holes: [H("3", 0), H("3", 0), H("3", 0)] }]);

    const changes = detectChanges(prev, next, [makeTracked("Matti", 1)]);

    // The correction on hole 1 is the first difference. Previously that alone
    // decided the outcome; now the newly played hole 3 is what gets reported.
    expect(changes).toHaveLength(1);
    expect(changes[0].hole).toBe(2);
  });

  it("skips holes that were cleared rather than played", () => {
    const H = (Result: string, Diff: number) => ({ Result, Diff, PEN: 0 });
    const prev = makeResponse([{ name: "Matti", sum: 7, holes: [H("4", 1), H("3", 0)] }]);
    const next = makeResponse([{ name: "Matti", sum: 4, holes: [H("4", 1), []] }]);

    // Hole 2's score was deleted - there is nothing to comment on.
    expect(detectChanges(prev, next, [makeTracked("Matti", 1)])).toHaveLength(0);
  });
});

// ── hasCompetitionEnded ────────────────────────────────────────────────────────

describe("hasCompetitionEnded", () => {
  it("returns false for empty player list", () => {
    expect(hasCompetitionEnded([])).toBe(false);
  });

  it("returns false when a player has unplayed holes (empty arrays)", () => {
    const player: TrackedPlayer = {
      Name: "Matti", id: 1, Diff: 0, OrderNumber: 1, ClassName: "MPO",
      PlayerResults: [{ Result: "3", Diff: 0, PEN: 0 }, []],
    };
    expect(hasCompetitionEnded([player])).toBe(false);
  });

  it("returns false when a player has no holes at all", () => {
    const player: TrackedPlayer = {
      Name: "Matti", id: 1, Diff: 0, OrderNumber: 1, ClassName: "MPO",
      PlayerResults: [],
    };
    expect(hasCompetitionEnded([player])).toBe(false);
  });

  it("returns true when all players have completed all holes", () => {
    const finished = (name: string): TrackedPlayer => ({
      Name: name, id: 1, Diff: 0, OrderNumber: 1, ClassName: "MPO",
      PlayerResults: [
        { Result: "3", Diff: 0, PEN: 0 },
        { Result: "4", Diff: 1, PEN: 0 },
      ],
    });
    expect(hasCompetitionEnded([finished("Matti"), finished("Pekka")])).toBe(true);
  });

  it("returns false when only some players are finished", () => {
    const finished: TrackedPlayer = {
      Name: "Matti", id: 1, Diff: 0, OrderNumber: 1, ClassName: "MPO",
      PlayerResults: [{ Result: "3", Diff: 0, PEN: 0 }],
    };
    const unfinished: TrackedPlayer = {
      Name: "Pekka", id: 2, Diff: 0, OrderNumber: 2, ClassName: "MPO",
      PlayerResults: [{ Result: "3", Diff: 0, PEN: 0 }, []],
    };
    expect(hasCompetitionEnded([finished, unfinished])).toBe(false);
  });
});
