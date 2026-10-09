import Poller from "./poller";
import { RoundCourseData } from "./courseData";
import { finishRound } from "./roundFinalizer";
import { msUntilStart } from "./policy";
import { ChatMessenger } from "../chatMessenger";
import { formatPlayerAnnouncement, formatRoundTopList } from "./messages";
import { findByChatId } from "../players";
import { addIfAbsent } from "../chats";
import * as competitionRepo from "./db/competitionRepository";
import { MetrixClient, RoundFetchResult } from "../../integrations/metrix/client";
import { OpenWeatherClient } from "../../integrations/openweather/client";
import { OllamaClient } from "../../integrations/ollama/client";
import { hasTrackedRoundEnded, isSamePlayerName, trackRoundPlayers } from "../../integrations/metrix/round/results";
import { MetrixRound, RoundPlayer, TrackedRoundPlayer } from "../../integrations/metrix/round/types";
import { createCommentaryWriter, RoundCommentary } from "../commentary";
import { getMissingTagPlayers } from "../bagtags";
import * as scoreService from "../score-records";
import { withWriteRetry } from "../../db/writeRetry";
import { moduleLogger } from "../../shared/logger";

const log = moduleLogger("live-scoring");

/** Stores the chat, if it's new, and the competition it starts following. */
export async function registerCompetition(chatId: number, chatName: string, metrixId: string): Promise<{ insertId: number }> {
  await addIfAbsent(chatId, chatName);
  return competitionRepo.create(chatId, metrixId);
}

/** What a tracker talks to: the chat, Metrix, the weather service and the commentary model. */
export interface TrackerDependencies {
  messenger: ChatMessenger;
  metrix: MetrixClient;
  openWeather: OpenWeatherClient;
  ollama: OllamaClient;
}

/**
 * How starting a tracker went. `unavailable`: Metrix didn't answer, so trying again can help.
 * `stopped`: the round was stopped (`/lopeta`) before it started.
 */
export type StartResult =
  | { kind: "following" }
  | { kind: "unavailable" }
  | { kind: "invalid"; error: unknown }
  | { kind: "no-players" }
  | { kind: "stopped" };

/**
 * `starting` until the first fetch has worked; a resumed round can stay there while it retries.
 * `finishing`: every tracked player is done and the round end waits for the last commentary.
 */
type TrackerState = "starting" | "following" | "finishing" | "stopped";

/** The state as shown: a followed round whose start time is still ahead is `scheduled`. */
export type TrackerPhase = TrackerState | "scheduled";

/**
 * Follows one Metrix round in one chat: polls it, hands every change to commentary, and finishes the round
 * once every tracked player is done. Created by `/follow`, and on startup for rounds still being followed.
 */
export class ScoreTracker {
  snapshot: MetrixRound | null = null;
  trackedPlayers: TrackedRoundPlayer[] = [];

  private state: TrackerState = "starting";
  private poller: Poller | null = null;
  private pollQueue: Promise<void> = Promise.resolve();
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
      updateSpecialScores: (playerId, played, update) => withWriteRetry("update special scores", () =>
        scoreService.updateSpecialScores({ playerId, chatId, competitionId: id }, played, update)),
      onError: error => log.error({ metrixId, err: error }, "commentary delivery failed"),
    });
  }

  get phase(): TrackerPhase {
    const startsAt = this.snapshot?.startsAt;
    if (this.state === "following" && startsAt && startsAt > new Date()) return "scheduled";

    return this.state;
  }

  /** The first fetch worked and the round hasn't been stopped: it has a snapshot to show. */
  get started(): boolean {
    return this.state === "following" || this.state === "finishing";
  }

  get stopped(): boolean {
    return this.state === "stopped";
  }

  /**
   * Loads the round, announces the players and starts polling. A round that couldn't start stays
   * `starting`, so it can be started again.
   */
  async start(): Promise<StartResult> {
    const initial = await this.metrix.getRound(this.metrixId);

    if (initial.kind === "unavailable") return { kind: "unavailable" };
    if (initial.kind === "invalid") {
      log.error({ metrixId: this.metrixId, err: initial.error }, "invalid initial round");
      return { kind: "invalid", error: initial.error };
    }

    this.snapshot = initial.round;
    await this.saveRoundDay(this.snapshot);

    this.trackedPlayers = await this.refreshTrackedPlayers(this.snapshot);
    if (this.trackedPlayers.length === 0 && !this.playersAnnounced) return { kind: "no-players" };

    this.commentary.observe(this.snapshot, this.trackedPlayers);
    await this.announceIfNeeded();

    if (this.stopped) return { kind: "stopped" };

    this.state = "following";
    this.startPolling(this.snapshot);
    log.info({ metrixId: this.metrixId, round: this.snapshot.name }, "started following");

    return { kind: "following" };
  }

  stopFollowing(): void {
    this.state = "stopped";
    this.poller?.stop();
    this.commentary.stop();
  }

  getScoreByPlayerName(name: string): RoundPlayer | undefined {
    const matching = this.snapshot?.players.filter(player => isSamePlayerName(player.name, name)) ?? [];

    // Like tracking: a name that several round players share, case aside, picks none of them.
    return matching.length === 1 ? matching[0] : undefined;
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
    if (this.state !== "following") return;
    if (result.kind !== "fetched") throw result.kind === "invalid" ? result.error : new Error("Metrix round request failed");

    const { round } = result;
    const tracked = await this.refreshTrackedPlayers(round);
    if (this.state !== "following") return;

    const changed = this.commentary.observe(round, tracked);
    if (changed) log.info({ metrixId: this.metrixId }, "score changes detected, commentary queued");

    this.snapshot = round;
    this.trackedPlayers = tracked;
    this.poller?.reportChanges(changed);

    if (hasTrackedRoundEnded(tracked)) this.queueRoundEnd(round, tracked);
  }

  /** The round ends only after the last commentary message has gone out. */
  private queueRoundEnd(round: MetrixRound, tracked: TrackedRoundPlayer[]): void {
    this.state = "finishing";
    this.poller?.stop();

    void this.commentary.idle().then(async () => {
      if (this.stopped) return;

      this.stopFollowing();
      log.info({ metrixId: this.metrixId, round: round.name }, "tracked scorecards are finished");

      await finishRound({
        chatId: this.chatId, competitionId: this.id, messenger: this.messenger, sendTopList: () => this.sendTopList(),
      }, round, tracked);
    }).catch(error => log.error({ metrixId: this.metrixId, err: error }, "end handler failed"));
  }

  /** The day is metadata: failing to save it is logged and never stops the round being followed. */
  private async saveRoundDay(round: MetrixRound): Promise<void> {
    const { day } = round;
    if (day === null) return;

    try {
      await withWriteRetry("save the round's day", () => competitionRepo.saveDay(this.id, day));
    } catch (error) {
      log.error({ metrixId: this.metrixId, err: error }, "could not save the round's day");
    }
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
