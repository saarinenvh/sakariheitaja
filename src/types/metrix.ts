export interface MetrixHoleResult {
  Result: string;
  Diff: number;
  PEN: number;
}

export type HoleEntry = MetrixHoleResult | [];

export interface MetrixPlayerResult {
  Name: string;
  Sum?: number;
  Diff: number;
  OrderNumber: number;
  ClassName: string;
  Group?: string;
  DNF?: string | null;
  PlayerResults?: HoleEntry[];
}

export interface MetrixCompetition {
  Name: string;
  Date: string;
  CourseName: string;
  Results: MetrixPlayerResult[];
}

export interface MetrixApiResponse {
  Competition: MetrixCompetition;
}

export type TrackedPlayer = MetrixPlayerResult & { id: number };

export interface PlayedHole {
  hole: number;
  holeResult: MetrixHoleResult;
}

export interface Change {
  playerName: string;
  playerId: number;
  prevPlayer: MetrixPlayerResult;
  newPlayer: MetrixPlayerResult;
  // The most recent hole this player completed in this poll window - the one
  // the commentary is about.
  hole: number;
  holeResult: MetrixHoleResult;
  // Any other holes that appeared in the same poll window (a scorekeeper
  // entering a few at once, or a longer gap between polls after a backoff).
  // Deliberately NOT commentated - one message per player per update - but
  // their scores still count, so aces and eagles in them get recorded.
  earlierHoles?: PlayedHole[];
}
