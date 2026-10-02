import { Standing } from "../../../../integrations/metrix/round/types";

export interface CommentaryScope {
  chatId: number;
  competitionId: string;
  division: string;
  playerId: number;
}

export interface PublishedStanding {
  scope: CommentaryScope;
  standing: Standing;
}

/** A player's place now against the place in the last delivered message; `unknown` without a firm baseline. */
export type StandingMovement =
  | { kind: "unknown" }
  | { kind: "unchanged"; position: number }
  | { kind: "up" | "down"; previousPosition: number; currentPosition: number; places: number };

export function comparePublishedStanding(
  scope: CommentaryScope,
  current: Standing,
  lastPublished: PublishedStanding | null,
): StandingMovement {
  if (!lastPublished || !sameCommentaryScope(scope, lastPublished.scope)) return { kind: "unknown" };
  const previous = lastPublished.standing;
  if (current.isProvisional || previous.isProvisional
    || current.position === null || previous.position === null) return { kind: "unknown" };
  if (current.position === previous.position) return { kind: "unchanged", position: current.position };
  return {
    kind: current.position < previous.position ? "up" : "down",
    previousPosition: previous.position,
    currentPosition: current.position,
    places: Math.abs(previous.position - current.position),
  };
}

export function sameCommentaryScope(previous: CommentaryScope, current: CommentaryScope): boolean {
  return previous.chatId === current.chatId
    && previous.competitionId === current.competitionId
    && previous.division === current.division
    && previous.playerId === current.playerId;
}
