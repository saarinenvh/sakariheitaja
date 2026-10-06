import Poller from "./poller";
import { RoundCourseData } from "./courseData";
import { finishRound } from "./roundFinalizer";
import { msUntilStart } from "./policy";
import { ChatMessenger } from "../chatMessenger";
import { formatPlayerAnnouncement, formatRoundTopList, liveScoringMessages as MSG } from "./messages";
import { findByChatId } from "../players";
import { addIfAbsent } from "../chats";
import * as competitionRepo from "./db/competitionRepository";
import { MetrixClient, RoundFetchResult } from "../../integrations/metrix/client";
import { OpenWeatherClient } from "../../integrations/openweather/client";
import { OllamaClient } from "../../integrations/ollama/client";
import { UnsupportedRoundError } from "../../integrations/metrix/round/normalize";
import { hasTrackedRoundEnded, trackRoundPlayers } from "../../integrations/metrix/round/results";
import { MetrixRound, RoundPlayer, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { createCommentaryWriter, RoundCommentary } from "../commentary";
import { getMissingTagPlayers } from "../bagtags";
import * as scoreService from "../score-records";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("live-scoring");

/** What a tracker talks to: the chat, Metrix, the weather service and the commentary model. */
/** Stores the chat, if it's new, and the competition it starts following. */
export async function registerCompetition(chatId: number, chatName: string, metrixId: string): Promise<{ insertId: number }> {
  await addIfAbsent(chatId, chatName);
  return competitionRepo.create(chatId, metrixId);
}

export interface TrackerDependencies {
  messenger: ChatMessenger;
  metrix: MetrixClient;
  openWeather: OpenWeatherClient;
  ollama: OllamaClient;
}

/**
 * Follows one Metrix round in one chat: polls it, hands every change to commentary, and finishes the round
 * once every tracked player is done. Created by `/follow`, and on startup for rounds still unfinished.
 */
export class ScoreTracker {
  following = true;
  snapshot: MetrixRound | null = null;
  trackedPlayers: TrackedRoundPlayer[] = [];
  initializationError: string | null = null;

  private poller: Poller | null = null;
  private pollQueue: Promise<void> = Promise.resolve();
  private endQueued = false;
  private readonly commentary: RoundCommentary;
  private readonly course: RoundCourseData;
  private readonly messenger: ChatMessenger;
  private readonly metrix: MetrixClient;

  constructor(
    public id: number, public metrixId: string, public chatId: number,
    dependencies: TrackerDependencies, private playersAnnounced = false,
  ) {
    const { messenger } = dependencies;
    this.messenger = messenger;
    this.metrix = dependencies.metrix;
    this.course = new RoundCourseData(dependencies.metrix, dependencies.openWeather, metrixId, () => this.snapshot);
    this.commentary = new RoundCommentary(chatId, metrixId, {
      write: createCommentaryWriter(dependencies.ollama),
      fetchWeather: () => this.course.weather(),
      fetchCourse: () => this.course.info(),
      send: async html => {
        await messenger.sendHtml(chatId, html);
        log.info({ metrixId, chars: html.length }, "commentary message sent");
      },
      updateSpecialScores: (playerId, played, update) =>
        scoreService.updateSpecialScores({ playerId, chatId, competitionId: id }, played, update),
      onError: error => log.error({ metrixId, err: error }, "commentary delivery failed"),
    });
  }

  /** Loads the round, announces the players and starts polling; `following` is false when it couldn't start. */
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
    if (this.snapshot.day !== null) await competitionRepo.saveDay(this.id, this.snapshot.day);

    this.trackedPlayers = await this.refreshTrackedPlayers(this.snapshot);
    if (this.trackedPlayers.length === 0 && !this.playersAnnounced) {
      await this.messenger.sendText(this.chatId, MSG.followNoPlayers);
      this.following = false;
      return this;
    }
    this.commentary.observe(this.snapshot, this.trackedPlayers);
    await this.announceIfNeeded();
    this.startPolling(this.snapshot);
    log.info({ metrixId: this.metrixId, round: this.snapshot.name }, "started following");
    return this;
  }

  stopFollowing(): void {
    this.following = false;
    this.poller?.stop();
    this.commentary.stop();
  }

  getScoreByPlayerName(name: string): RoundPlayer | undefined {
    return this.snapshot?.players.find(player => player.name === name);
  }

  async sendTopList(): Promise<void> {
    if (!this.snapshot) return;
    const message = formatRoundTopList(this.snapshot, this.trackedPlayers, await this.course.info());
    await this.messenger.sendText(this.chatId, message);
  }

  private startPolling(round: MetrixRound): void {
    this.poller = new Poller(this.metrixId, () => this.metrix.getRound(this.metrixId));
    this.poller.on("data", (result: RoundFetchResult) => this.enqueuePoll(result));
    this.poller.on("fetchError", (error: Error) => log.error({ metrixId: this.metrixId, err: error }, "poll failed"));
    this.poller.start(msUntilStart(round.startsAt, new Date()));
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

  /** The round ends only after the last commentary message has gone out. */
  private queueRoundEnd(round: MetrixRound, tracked: TrackedRoundPlayer[]): void {
    this.endQueued = true;
    this.poller?.stop();
    void this.commentary.idle().then(async () => {
      if (!this.following) return;
      this.stopFollowing();
      log.info({ metrixId: this.metrixId, round: round.name }, "tracked scorecards are finished");
      await finishRound({
        chatId: this.chatId, competitionId: this.id, messenger: this.messenger, sendTopList: () => this.sendTopList(),
      }, round, tracked);
    }).catch(error => log.error({ metrixId: this.metrixId, err: error }, "end handler failed"));
  }

  private async refreshTrackedPlayers(round: MetrixRound): Promise<TrackedRoundPlayer[]> {
    const players = await findByChatId(this.chatId);
    return trackRoundPlayers(round, players);
  }

  private async announceIfNeeded(): Promise<void> {
    if (!this.snapshot || this.trackedPlayers.length === 0 || this.playersAnnounced) return;
    const names = this.trackedPlayers.map(tracked => tracked.player.name);
    const missingTags = getMissingTagPlayers(this.chatId, names.map(name => ({ Name: name })));
    await this.messenger.sendHtml(this.chatId, formatPlayerAnnouncement(this.metrixId, this.snapshot.courseName, names, missingTags));
    this.playersAnnounced = true;
  }
}
