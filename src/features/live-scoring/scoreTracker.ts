import Poller from "./poller";
import { formatTopList } from "./topList";
import { truncateCourseName } from "../disc-golf/courseName";
import * as playerRepo from "../../db/repositories/PlayerRepository";
import * as competitionService from "../disc-golf/services/CompetitionService";
import * as courseService from "../disc-golf/services/CourseService";
import * as scoreService from "../disc-golf/services/ScoreService";
import { competition as MSG } from "../../config/messages";
import { ChatMessenger } from "../chatMessenger";
import { updateProfiles } from "../disc-golf/scores/playerProfiles";
import { computeAndApplySwaps, formatBagtagAnnouncement, getMissingTagPlayers, selectBagtagParticipants } from "../disc-golf/scores/bagtags";
import { escapeHtml } from "../disc-golf/commentary/format/commentaryMessage";
import { RoundCommentary } from "../disc-golf/commentary/roundCommentary";
import { writeRoundCommentary } from "../disc-golf/commentary/write/commentaryRuntime";
import {
  hasTrackedRoundEnded, selectFinalScores, selectRankedResults, selectTrackedRankedResults, trackRoundPlayers,
} from "../../integrations/metrix/round/results";
import { MetrixRound, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { UnsupportedRoundError } from "../../integrations/metrix/round/normalize";
import { MetrixClient, RoundFetchResult } from "../../integrations/metrix/client";
import { moduleLogger } from "../../shared/logger";
import { fetchCurrentWeather, WeatherObservation } from "../../shared/weather";
import { CourseLocationResult } from "../../integrations/metrix/location/courseLocation";
import { CourseInfo } from "../disc-golf/commentary/facts/courseCommentaryFacts";
import { buildRoundRatings } from "../disc-golf/commentary/facts/roundRatings";
import { CourseDetails } from "../../integrations/metrix/course/courseDetails";
import { CourseStatistics } from "../../integrations/metrix/statistics/courseStatistics";

const log = moduleLogger("orchestrator");

export class Orchestrator {
  following = true;
  snapshot: MetrixRound | null = null;
  trackedPlayers: TrackedRoundPlayer[] = [];
  initializationError: string | null = null;

  private poller: Poller | null = null;
  private pollQueue: Promise<void> = Promise.resolve();
  private endQueued = false;
  private commentary: RoundCommentary;
  private courseLocation: CourseLocationResult | null = null;
  private courseInfo: Promise<CourseInfo> | null = null;

  constructor(
    public id: number, public metrixId: string, public chatId: number,
    private readonly messenger: ChatMessenger, private readonly metrix: MetrixClient, private playersAnnounced = false,
  ) {
    this.commentary = new RoundCommentary(chatId, metrixId, {
      write: writeRoundCommentary,
      fetchWeather: () => this.fetchCourseWeather(),
      fetchCourse: () => this.fetchCourseInfo(),
      send: async html => {
        await messenger.sendHtml(chatId, html);
        log.info({ metrixId, chars: html.length }, "commentary message sent");
      },
      saveScores: (playerId, courseName, changes) => scoreService.saveRecordedScores(playerId, changes, chatId, id, courseName),
      onError: error => log.error({ metrixId, err: error }, "commentary delivery failed"),
    });
  }

  async init(): Promise<this> {
    const initial = await this.metrix.getRound(this.metrixId);
    if (initial.kind !== "fetched") {
      const error = initial.kind === "invalid" ? initial.error : new Error("Metrix round request failed");
      log.error({ metrixId: this.metrixId, err: error }, "invalid initial round");
      this.initializationError = error instanceof UnsupportedRoundError ? error.message : MSG.followInvalid;
      this.following = false;
      return this;
    }
    this.snapshot = initial.round;
    this.trackedPlayers = await this.refreshTrackedPlayers(this.snapshot);
    if (this.trackedPlayers.length === 0 && !this.playersAnnounced) {
      await this.messenger.sendText(this.chatId, MSG.followNoPlayers);
      this.following = false;
      return this;
    }
    this.commentary.observe(this.snapshot, this.trackedPlayers);
    await this.announceIfNeeded();
    const initialDelay = this.msUntilStart(this.snapshot.date);
    this.poller = new Poller(this.metrixId, () => this.metrix.getRound(this.metrixId));
    this.poller.on("data", (result: RoundFetchResult) => this.enqueuePoll(result));
    this.poller.on("fetchError", (error: Error) => log.error({ metrixId: this.metrixId, err: error }, "poll failed"));
    this.poller.start(initialDelay);
    log.info({ metrixId: this.metrixId, round: this.snapshot.name }, "started following");
    return this;
  }

  private async fetchCourseWeather(): Promise<WeatherObservation | null> {
    const round = this.snapshot;
    if (!round?.courseId) return null;
    const layoutLocation = (await this.fetchCourseInfo()).details?.location ?? null;
    const location = layoutLocation ? { kind: "found" as const, location: { ...layoutLocation, city: null } } : this.courseLocation
      ?? await this.metrix.findCourseLocation(round.courseId, round.courseName);
    if (!layoutLocation && location.kind !== "failed") this.courseLocation = location;
    if (location.kind !== "found") {
      log.warn({ metrixId: this.metrixId, location: location.kind }, "no course location for weather");
      return null;
    }
    const weather = await fetchCurrentWeather(location.location);
    if (weather.kind === "failed") {
      log.warn({ metrixId: this.metrixId, reason: weather.reason }, "weather unavailable");
      return null;
    }
    const { temperatureC, description } = weather.observation;
    log.info({ metrixId: this.metrixId, temperatureC, description }, "weather observed");
    return weather.observation;
  }

  /** Fetched once per round; each part is null when Metrix doesn't have it or the key isn't configured. */
  private fetchCourseInfo(): Promise<CourseInfo> {
    this.courseInfo ??= this.loadCourseInfo();
    return this.courseInfo;
  }

  private async loadCourseInfo(): Promise<CourseInfo> {
    const courseId = this.snapshot?.courseId;
    if (!courseId) return { details: null, statistics: null };
    const [details, statistics] = await Promise.all([
      this.loadCourseDetails(courseId).catch(error => this.reportCourseDataFailure("details", error)),
      this.loadCourseStatistics(courseId).catch(error => this.reportCourseDataFailure("statistics", error)),
    ]);
    log.info({ metrixId: this.metrixId }, `course data ${details ? "with" : "without"} layout details, ${statistics ? "with" : "without"} statistics`);
    return { details, statistics };
  }

  private reportCourseDataFailure(part: string, error: unknown): null {
    log.warn({ metrixId: this.metrixId, err: error }, `course ${part} unavailable`);
    return null;
  }

  private async loadCourseDetails(courseId: string): Promise<CourseDetails | null> {
    const result = await this.metrix.getCourseDetails(courseId);
    if (result.kind === "found") return result.details;
    if (result.kind === "unconfigured") return null;
    log.warn({ metrixId: this.metrixId, reason: result.reason }, "course details unavailable");
    return null;
  }

  private async loadCourseStatistics(courseId: string): Promise<CourseStatistics | null> {
    const result = await this.metrix.getCourseStatistics(courseId);
    if (result.kind === "found") return result.statistics;
    if (result.kind === "failed") log.warn({ metrixId: this.metrixId, reason: result.reason }, "course statistics unavailable");
    return null;
  }

  stopFollowing(): void {
    this.following = false;
    this.poller?.stop();
    this.commentary.stop();
  }

  getScoreByPlayerName(name: string): MetrixRound["players"][number] | undefined {
    return this.snapshot?.players.find(player => player.name === name);
  }

  async sendTopList(): Promise<void> {
    if (!this.snapshot) return;
    const { details } = await this.fetchCourseInfo();
    const ratings = buildRoundRatings(details?.rating ?? null, this.snapshot.players);
    const message = formatTopList(
      this.snapshot.name, selectRankedResults(this.snapshot.players), selectTrackedRankedResults(this.trackedPlayers), ratings,
    );
    await this.messenger.sendText(this.chatId, message);
  }

  private enqueuePoll(result: RoundFetchResult): Promise<void> {
    this.pollQueue = this.pollQueue.then(() => this.onPollResult(result)).catch(error => {
      log.error({ metrixId: this.metrixId, err: error }, "rejected poll");
      this.poller?.reportChanges(false);
    });
    return this.pollQueue;
  }

  private async onPollResult(result: RoundFetchResult): Promise<void> {
    if (!this.following || this.endQueued) return;
    if (result.kind !== "fetched") throw result.kind === "invalid" ? result.error : new Error("Metrix round request failed");
    const { round } = result;
    const tracked = await this.refreshTrackedPlayers(round);
    if (!this.following) return;
    const changed = this.commentary.observe(round, tracked);
    if (changed) log.info({ metrixId: this.metrixId }, "score changes detected, commentary queued");
    this.snapshot = round;
    this.trackedPlayers = tracked;
    this.poller?.reportChanges(changed);
    if (hasTrackedRoundEnded(tracked)) this.queueRoundEnd(round, tracked);
  }

  private queueRoundEnd(round: MetrixRound, tracked: TrackedRoundPlayer[]): void {
    this.endQueued = true;
    this.poller?.stop();
    void this.commentary.idle().then(async () => {
      if (!this.following) return;
      await this.handleRoundEnd(round, tracked);
    }).catch(error => log.error({ metrixId: this.metrixId, err: error }, "end handler failed"));
  }

  private async handleRoundEnd(round: MetrixRound, tracked: TrackedRoundPlayer[]): Promise<void> {
    this.stopFollowing();
    log.info({ metrixId: this.metrixId, round: round.name }, "tracked scorecards are finished");
    await this.messenger.sendText(this.chatId, MSG.endSoon);
    await competitionService.markDone(this.id);
    const course = await courseService.getOrCreate(round.courseName);
    if (course) await scoreService.saveResults(selectFinalScores(tracked), this.chatId, course.id, this.id);
    updateProfiles(this.chatId, selectTrackedRankedResults(tracked), selectRankedResults(round.players));
    const bagtags = computeAndApplySwaps(this.chatId, selectBagtagParticipants(tracked));
    await this.sendTopList();
    await this.messenger.sendHtml(this.chatId, formatBagtagAnnouncement(bagtags));
  }

  private async refreshTrackedPlayers(round: MetrixRound): Promise<TrackedRoundPlayer[]> {
    const players = await playerRepo.findByChatId(this.chatId);
    return trackRoundPlayers(round, players);
  }

  private async announceIfNeeded(): Promise<void> {
    if (!this.snapshot || this.trackedPlayers.length === 0 || this.playersAnnounced) return;
    const course = `<a href="https://discgolfmetrix.com/${this.metrixId}">${escapeHtml(truncateCourseName(this.snapshot.courseName))}</a>`;
    let message = `Peliareenana toimii ${course}\n\nJa tällä kertaa kisassa on mukana:\n`;
    for (const tracked of this.trackedPlayers) message += `${escapeHtml(tracked.player.name)}\n`;
    const names = this.trackedPlayers.map(tracked => ({ Name: tracked.player.name }));
    const missingTags = getMissingTagPlayers(this.chatId, names);
    if (missingTags.length > 0) {
      message += `\n🏷️ Ilman tägiä: ${missingTags.map(escapeHtml).join(", ")}\nAseta: /bagtag set [nimi] [numero]`;
    }
    await this.messenger.sendHtml(this.chatId, message);
    this.playersAnnounced = true;
  }

  private msUntilStart(date: string): number {
    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const difference = new Date(date).getTime() + offsetMs - Date.now();
    return difference > 0 ? difference : 0;
  }
}
