import { PublishedStanding } from "./detect/standingMovement";
import { compareScorecards, ScoreChange } from "./detect/scorecardChanges";
import { buildFactualCommentaryBrief, CommentarySnapshot, FactualCommentaryBrief } from "./facts/playerBrief";
import { buildCommentarySnapshot } from "./detect/commentarySnapshot";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { formatBatchCommentaryMessages } from "./format/commentaryMessage";
import { BatchCommentaryContext, BatchContextInput, buildBatchCommentaryContext } from "./facts/commentaryContext";
import { WeatherFacts } from "./facts/weatherFacts";
import { BatchCommentaryResult } from "./write/commentaryWriter";
import { WeatherObservation } from "../../integrations/openweather/client";
import { describeWeather, describeWeatherChange } from "./facts/weatherFacts";
import { CourseInfo } from "./facts/courseCommentaryFacts";

const RECENT_MESSAGE_COUNT = 3;
const COURSE_INFO_TIMEOUT_MS = 15_000;
const WEATHER_FACTS_TIMEOUT_MS = 15_000;
const NO_COURSE_INFO: CourseInfo = { details: null, statistics: null };
const WEATHER_RECHECK_PROGRESS_FRACTION = 0.5;

export interface CommentaryDelivery {
  write(context: BatchCommentaryContext): Promise<BatchCommentaryResult>;
  fetchWeather(): Promise<WeatherObservation | null>;
  /** Course layout and statistics; called once per round, and may return empty parts. */
  fetchCourse(): Promise<CourseInfo>;
  send(html: string): Promise<unknown>;
  saveScores(playerId: number, courseName: string, changes: readonly ScoreChange[]): Promise<void>;
  onError(error: unknown): void;
}

interface ObservedPlayer {
  sourceId: number | null;
  snapshot: CommentarySnapshot;
  recordedHoles: Set<number>;
}

interface PendingUpdate {
  current: CommentarySnapshot;
  changes: readonly ScoreChange[];
  firstRecorded: readonly number[];
}

interface ObservationBatch {
  round: MetrixRound;
  resetPlayers: number[];
  updates: PendingUpdate[];
}

interface PendingBrief {
  current: CommentarySnapshot;
  brief: FactualCommentaryBrief;
}

interface PendingPost extends PendingBrief {
  text: string;
}

type RoundWeather =
  | { kind: "not-fetched" }
  | { kind: "started"; start: WeatherObservation | null }
  | { kind: "rechecked" };

export class RoundCommentary {
  private observed = new Map<number, ObservedPlayer>();
  private published = new Map<number, PublishedStanding>();
  private recentMessages = new Map<string, string[]>();
  private weather: RoundWeather = { kind: "not-fetched" };
  private latestWeather: WeatherObservation | null = null;
  private welcomedDivisions = new Set<string>();
  private course: Promise<CourseInfo> | null = null;
  private observedLayout: string | null = null;
  private publishedLayout: string | null = null;
  private queue: Promise<void> = Promise.resolve();
  private active = true;

  constructor(private readonly chatId: number, private readonly metrixId: string, private readonly delivery: CommentaryDelivery) {}

  observe(round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): boolean {
    if (!this.active) return false;
    if (round.id !== this.metrixId) throw new Error("Commentary round scope mismatch");
    const batch = this.captureObservation(round, tracked);
    this.queue = this.queue.then(() => this.publishBatch(batch)).catch(error => this.delivery.onError(error));
    return batch.updates.length > 0;
  }

  idle(): Promise<void> {
    return this.queue;
  }

  stop(): void {
    this.active = false;
    this.observed.clear();
    this.published.clear();
    this.recentMessages.clear();
    this.welcomedDivisions.clear();
  }

  private captureObservation(round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): ObservationBatch {
    if (this.observedLayout !== round.layoutKey) this.observed.clear();
    this.observedLayout = round.layoutKey;
    const batch: ObservationBatch = { round, resetPlayers: [], updates: [] };
    const currentPlayers = new Map<number, ObservedPlayer>();
    for (const player of tracked) {
      const current = buildCommentarySnapshot(round, player, this.chatId);
      const previous = this.observed.get(player.id);
      const samePlayer = previous?.sourceId === player.player.sourceId
        && previous?.snapshot.scope.division === current.scope.division;
      const recordedHoles = new Set(samePlayer ? previous.recordedHoles : []);
      const firstRecorded: number[] = [];
      if (current.scorecard.kind === "available") {
        current.scorecard.holes.forEach((score, index) => {
          if (score === null) return;
          if (!recordedHoles.has(index + 1)) firstRecorded.push(index + 1);
          recordedHoles.add(index + 1);
        });
      }
      currentPlayers.set(player.id, { sourceId: player.player.sourceId, snapshot: current, recordedHoles });
      if (!samePlayer || !previous) {
        batch.resetPlayers.push(player.id);
        continue;
      }
      const comparison = compareScorecards(previous.snapshot.scorecard, current.scorecard);
      if (comparison.kind === "compared" && comparison.changes.length > 0) {
        batch.updates.push({ current, changes: comparison.changes, firstRecorded });
      }
    }
    for (const playerId of this.observed.keys()) {
      if (!currentPlayers.has(playerId)) batch.resetPlayers.push(playerId);
    }
    this.observed = currentPlayers;
    return batch;
  }

  private async publishBatch(batch: ObservationBatch): Promise<void> {
    if (!this.active) return;
    // Saved before any writing or sending, so neither can lose a score.
    for (const update of batch.updates) await this.saveScores(update);
    this.resetPublishedState(batch);
    for (const [division, pending] of this.buildBriefsByDivision(batch.updates)) {
      if (!this.active) return;
      const [weather, course] = await Promise.all([this.loadWeatherFacts(pending.map(entry => entry.brief)), this.loadCourse()]);
      const context = this.buildContext({
        round: batch.round, division, briefs: pending.map(entry => entry.brief), weather,
        latestWeather: this.latestWeather, course,
        firstMessage: !this.welcomedDivisions.has(division),
        recentMessages: [...(this.recentMessages.get(division) ?? [])],
      });
      const result = await this.delivery.write(context);
      await this.deliverBatch(division, result, pending, context.roundRatings);
    }
  }

  private resetPublishedState(batch: ObservationBatch): void {
    if (this.publishedLayout !== batch.round.layoutKey) {
      this.published.clear();
      this.recentMessages.clear();
      this.publishedLayout = batch.round.layoutKey;
    }
    for (const playerId of batch.resetPlayers) this.published.delete(playerId);
  }

  private buildBriefsByDivision(updates: readonly PendingUpdate[]): Map<string, PendingBrief[]> {
    const byDivision = new Map<string, PendingBrief[]>();
    for (const { current, changes } of updates) {
      const brief = buildFactualCommentaryBrief({
        current, changes, lastPublished: this.published.get(current.scope.playerId) ?? null,
      });
      const division = byDivision.get(brief.division) ?? [];
      division.push({ current, brief });
      byDivision.set(brief.division, division);
    }
    return byDivision;
  }

  private async deliverBatch(
    division: string, result: BatchCommentaryResult, pending: readonly PendingBrief[], roundRatings: ReadonlyMap<string, number>,
  ): Promise<void> {
    const { opening, lines, closing } = result.commentary;
    const posts: PendingPost[] = pending.map((entry, index) => ({ ...entry, text: lines[index].text }));
    for (const message of formatBatchCommentaryMessages(opening, posts, closing, this.metrixId, roundRatings)) {
      if (!this.active) return;
      await this.delivery.send(message.html);
      if (!this.active) return;
      for (const post of message.posts) this.acknowledge(post);
    }
    this.welcomedDivisions.add(division);
    if (result.kind === "generated") this.rememberMessage(division, [opening, ...lines.map(line => line.text), closing]);
  }

  private async collectWeatherFacts(briefs: readonly FactualCommentaryBrief[]): Promise<WeatherFacts | null> {
    if (this.weather.kind === "not-fetched") {
      const start = await this.fetchWeather();
      this.weather = { kind: "started", start };
      return start ? { current: describeWeather(start), changeSinceStart: null } : null;
    }
    if (this.weather.kind !== "started" || maxProgressFraction(briefs) < WEATHER_RECHECK_PROGRESS_FRACTION) return null;
    const { start } = this.weather;
    this.weather = { kind: "rechecked" };
    const current = await this.fetchWeather();
    const change = start && current ? describeWeatherChange(start, current) : null;
    return current && change ? { current: describeWeather(current), changeSinceStart: change } : null;
  }

  private async fetchWeather(): Promise<WeatherObservation | null> {
    try {
      const observation = await this.delivery.fetchWeather();
      if (observation) this.latestWeather = observation;
      return observation;
    } catch (error) {
      this.delivery.onError(error);
      return null;
    }
  }

  /** Weather is optional enrichment too, bounded so that it never delays the message by more than the course data. */
  private loadWeatherFacts(briefs: readonly FactualCommentaryBrief[]): Promise<WeatherFacts | null> {
    return withTimeout(this.collectWeatherFacts(briefs), WEATHER_FACTS_TIMEOUT_MS, "Weather").catch(error => {
      this.delivery.onError(error);
      return null;
    });
  }

  /** Course facts are optional enrichment: a failure or a hang must never hold back the commentary. */
  private loadCourse(): Promise<CourseInfo> {
    this.course ??= withTimeout(this.delivery.fetchCourse(), COURSE_INFO_TIMEOUT_MS, "Course data").catch(error => {
      this.delivery.onError(error);
      return NO_COURSE_INFO;
    });
    return this.course;
  }

  private buildContext(input: BatchContextInput): BatchCommentaryContext {
    try {
      return buildBatchCommentaryContext(input);
    } catch (error) {
      this.delivery.onError(error);
      return buildBatchCommentaryContext({ ...input, course: NO_COURSE_INFO });
    }
  }

  private async saveScores(update: PendingUpdate): Promise<void> {
    const { current, changes, firstRecorded } = update;
    const newScores = changes.filter(change => change.kind === "recorded" && firstRecorded.includes(change.holeNumber));
    try {
      await this.delivery.saveScores(current.scope.playerId, current.courseName, newScores);
    } catch (error) {
      this.delivery.onError(error);
    }
  }

  private acknowledge(post: PendingPost): void {
    const { scope, standing } = post.current;
    this.published.set(scope.playerId, { scope, standing });
  }

  private rememberMessage(division: string, parts: readonly string[]): void {
    const messages = this.recentMessages.get(division) ?? [];
    messages.push(parts.filter(part => part.trim()).join("\n"));
    this.recentMessages.set(division, messages.slice(-RECENT_MESSAGE_COUNT));
  }
}

function maxProgressFraction(briefs: readonly FactualCommentaryBrief[]): number {
  let fraction = 0;
  for (const { round: { progress } } of briefs) {
    if (progress.kind === "unknown" || progress.totalHoles === null || progress.totalHoles === 0) continue;
    fraction = Math.max(fraction, progress.completedHoles / progress.totalHoles);
  }
  return fraction;
}

function withTimeout<Value>(promise: Promise<Value>, timeoutMs: number, what: string): Promise<Value> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} not available within ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
