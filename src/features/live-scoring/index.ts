export { registerCompetition, ScoreTracker } from "./liveScoring";
export type { StartResult, TrackerDependencies } from "./liveScoring";
export { resumeRound } from "./roundResumer";
export * as trackerRegistry from "./trackerRegistry";
export * as competitionRepository from "./db/competitionRepository";
export type { ErroredRound } from "./db/competitionRepository";
