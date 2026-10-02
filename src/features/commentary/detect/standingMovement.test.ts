import { describe, expect, it } from "vitest";
import { CommentaryScope, comparePublishedStanding } from "./standingMovement";
import { parseStanding } from "../../../integrations/metrix/round/normalize";

const scope: CommentaryScope = {
  chatId: -100, competitionId: "competition", division: "MA3", playerId: 1,
};

describe("standing movement since publication", () => {
  it.each([
    { previous: 11, current: 10, kind: "up" },
    { previous: 10, current: 11, kind: "down" },
  ])("compares numeric positions correctly ($kind)", ({ previous, current, kind }) => {
    expect(comparePublishedStanding(scope, parseStanding({ position: String(current), isProvisional: false }), {
      scope, standing: parseStanding({ position: String(previous), isProvisional: false }),
    })).toEqual({ kind, previousPosition: previous, currentPosition: current, places: 1 });
  });

  it("reports unchanged positions explicitly", () => {
    const standing = parseStanding({ position: 15, isProvisional: false });
    expect(comparePublishedStanding(scope, standing, { scope, standing })).toEqual({ kind: "unchanged", position: 15 });
  });

  it("does not invent movement without a published baseline", () => {
    expect(comparePublishedStanding(scope, parseStanding({ position: 1, isProvisional: false }), null))
      .toEqual({ kind: "unknown" });
  });

  it.each([
    { position: null, isProvisional: false },
    { position: 10, isProvisional: true },
  ])("requires known non-provisional positions on both sides (%j)", uncertain => {
    const known = parseStanding({ position: 11, isProvisional: false });
    const standing = parseStanding(uncertain);
    expect(comparePublishedStanding(scope, known, { scope, standing })).toEqual({ kind: "unknown" });
    expect(comparePublishedStanding(scope, standing, { scope, standing: known })).toEqual({ kind: "unknown" });
  });

  it.each([
    { chatId: -200 }, { competitionId: "other" }, { division: "MPO" }, { playerId: 2 },
  ])("rejects a published baseline from a different scope (%j)", mismatch => {
    expect(comparePublishedStanding(scope, parseStanding({ position: 1, isProvisional: false }), {
      scope: { ...scope, ...mismatch }, standing: parseStanding({ position: 10, isProvisional: false }),
    })).toEqual({ kind: "unknown" });
  });
});
