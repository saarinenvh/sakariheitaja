import { bot } from "../../../bot/bot";
import Poller from "./poller";
import { formatTopList, truncateCourseName } from "./topList";
import * as playerRepo from "../../../db/repositories/PlayerRepository";
import * as competitionService from "../services/CompetitionService";
import * as courseService from "../services/CourseService";
import * as scoreService from "../services/ScoreService";
import { competition as MSG } from "../../../config/messages";
import { HTML_NO_PREVIEW } from "../../../config/bot";
import { updateProfiles } from "../scores/playerProfiles";
import { computeAndApplySwaps, formatBagtagAnnouncement, getMissingTagPlayers } from "../scores/bagtags";
import { escapeHtml } from "../commentary/presentation";
import { RoundCommentary } from "../commentary/roundCommentary";
import { writeRoundCommentary } from "../commentary/writer/commentaryRuntime";
import {
  hasTrackedRoundEnded, MetrixRound, parseMetrixRound, toBagtagPlayers, toFinalScores, toLegacyResults, toLegacyTracked,
  TrackedRoundPlayer, trackRoundPlayers, UnsupportedRoundError,
} from "../metrix/metrixRound";
import Logger from "js-logger";
import { env } from "../../../shared/env";
import { fetchCurrentWeather, WeatherObservation } from "../../../shared/weather";
import { CourseLocationResult, fetchCourseLocation } from "../metrix/courseLocation";
import { CourseInfo } from "../commentary/facts/holeFacts";
import { CourseDetails, fetchCourseDetails } from "../metrix/metrixCourse";
import { CourseStatistics, fetchCourseStatistics } from "../metrix/courseStatistics";

const BASE_URL = "https://discgolfmetrix.com/api.php?content=result&id=";
const DEFAULT_COUNTRY_CODE = "FI";

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
    public id: number, public metrixId: string, public chatId: number, private playersAnnounced = false,
  ) {
    this.commentary = new RoundCommentary(chatId, metrixId, {
      write: writeRoundCommentary,
      fetchWeather: () => this.fetchCourseWeather(),
      fetchCourse: () => this.fetchCourseInfo(),
      send: async html => {
        const sent = await bot.api.sendMessage(chatId, html, HTML_NO_PREVIEW);
        Logger.info(`${metrixId}: commentary message sent (${html.length} chars)`);
        return sent;
      },
      saveScores: (playerId, courseName, changes) => scoreService.saveRecordedScores(playerId, changes, chatId, id, courseName),
      onError: error => Logger.error(`${metrixId}: commentary delivery failed`, error),
    });
  }

  async init(): Promise<this> {
    const { getData } = await import("../../../shared/http");
    try {
      const input = await getData<unknown>(`${BASE_URL}${this.metrixId}`);
      this.snapshot = parseMetrixRound(input, this.metrixId);
    } catch (error) {
      Logger.error(`Orchestrator ${this.metrixId}: invalid initial round`, error);
      this.initializationError = error instanceof UnsupportedRoundError ? error.message : MSG.followInvalid;
      this.following = false;
      return this;
    }
    this.trackedPlayers = await this.refreshTrackedPlayers(this.snapshot);
    if (this.trackedPlayers.length === 0 && !this.playersAnnounced) {
      await bot.api.sendMessage(this.chatId, MSG.followNoPlayers);
      this.following = false;
      return this;
    }
    this.commentary.observe(this.snapshot, this.trackedPlayers);
    await this.announceIfNeeded();
    const initialDelay = this.msUntilStart(this.snapshot.date);
    this.poller = new Poller(this.metrixId, BASE_URL);
    this.poller.on("data", (input: unknown) => this.enqueuePoll(input));
    this.poller.on("fetchError", (error: Error) => Logger.error(`${this.metrixId}: ${error.message}`));
    this.poller.start(initialDelay);
    Logger.info(`Started following: ${this.snapshot.name} (${this.metrixId})`);
    return this;
  }

  private async fetchCourseWeather(): Promise<WeatherObservation | null> {
    const round = this.snapshot;
    if (!round?.courseId) return null;
    const layoutLocation = (await this.fetchCourseInfo()).details?.location ?? null;
    const location = layoutLocation ? { kind: "found" as const, location: { ...layoutLocation, city: null } } : this.courseLocation
      ?? await fetchCourseLocation(round.courseId, round.courseName, env("BOT_COMMENTARY_COUNTRY_CODE") ?? DEFAULT_COUNTRY_CODE);
    if (!layoutLocation && location.kind !== "failed") this.courseLocation = location;
    if (location.kind !== "found") {
      Logger.warn(`${this.metrixId}: no course location for weather (${location.kind})`);
      return null;
    }
    const weather = await fetchCurrentWeather(location.location);
    if (weather.kind === "failed") {
      Logger.warn(`${this.metrixId}: weather unavailable: ${weather.reason}`);
      return null;
    }
    Logger.info(`${this.metrixId}: weather ${weather.observation.temperatureC} °C, ${weather.observation.description}`);
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
    const [details, statistics] = await Promise.all([this.loadCourseDetails(courseId), this.loadCourseStatistics(courseId)]);
    Logger.info(`${this.metrixId}: course data ${details ? "with" : "without"} layout details, ${statistics ? "with" : "without"} statistics`);
    return { details, statistics };
  }

  private async loadCourseDetails(courseId: string): Promise<CourseDetails | null> {
    const integrationCode = env("BOT_METRIX_INTEGRATION_CODE");
    if (!integrationCode) return null;
    const result = await fetchCourseDetails(courseId, integrationCode);
    if (result.kind === "found") return result.details;
    Logger.warn(`${this.metrixId}: course details unavailable: ${result.reason}`);
    return null;
  }

  private async loadCourseStatistics(courseId: string): Promise<CourseStatistics | null> {
    const result = await fetchCourseStatistics(courseId);
    if (result.kind === "found") return result.statistics;
    if (result.kind === "failed") Logger.warn(`${this.metrixId}: course statistics unavailable: ${result.reason}`);
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
    const message = formatTopList(this.snapshot.name, toLegacyResults(this.snapshot.players), toLegacyTracked(this.trackedPlayers));
    await bot.api.sendMessage(this.chatId, message);
  }

  private enqueuePoll(input: unknown): Promise<void> {
    this.pollQueue = this.pollQueue.then(() => this.onPollResult(input)).catch(error => {
      Logger.error(`Orchestrator ${this.metrixId}: rejected poll`, error);
      this.poller?.reportChanges(false);
    });
    return this.pollQueue;
  }

  private async onPollResult(input: unknown): Promise<void> {
    if (!this.following || this.endQueued) return;
    const round = parseMetrixRound(input, this.metrixId);
    const tracked = await this.refreshTrackedPlayers(round);
    if (!this.following) return;
    const changed = this.commentary.observe(round, tracked);
    if (changed) Logger.info(`${this.metrixId}: score changes detected, commentary queued`);
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
    }).catch(error => Logger.error(`${this.metrixId}: end handler failed`, error));
  }

  private async handleRoundEnd(round: MetrixRound, tracked: TrackedRoundPlayer[]): Promise<void> {
    this.stopFollowing();
    Logger.info(`Tracked scorecards in ${round.name}, ${this.metrixId} are finished`);
    await bot.api.sendMessage(this.chatId, MSG.endSoon);
    await competitionService.markDone(this.id);
    const completed = toLegacyTracked(tracked).filter(player => !player.DNF);
    const results = toLegacyResults(round.players);
    const course = await courseService.getOrCreate(round.courseName);
    if (course) await scoreService.saveResults(toFinalScores(tracked), this.chatId, course.id, this.id);
    updateProfiles(this.chatId, completed, results);
    const participants = toBagtagPlayers(tracked);
    const bagtags = computeAndApplySwaps(this.chatId, participants, participants);
    await bot.api.sendMessage(this.chatId, formatBagtagAnnouncement(bagtags), HTML_NO_PREVIEW);
    await this.sendTopList();
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
    await bot.api.sendMessage(this.chatId, message, HTML_NO_PREVIEW);
    this.playersAnnounced = true;
  }

  private msUntilStart(date: string): number {
    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const difference = new Date(date).getTime() + offsetMs - Date.now();
    return difference > 0 ? difference : 0;
  }
}
