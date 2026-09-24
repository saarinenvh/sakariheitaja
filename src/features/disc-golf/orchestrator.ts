import { bot } from "../../bot/bot";
import Poller from "./poller";
import { detectChanges, hasCompetitionEnded } from "./changeDetector";
import { formatCommentaryMessage, formatTopList, truncateCourseName } from "./commentary";
import * as playerRepo from "../../db/repositories/PlayerRepository";
import * as competitionService from "./services/CompetitionService";
import * as courseService from "./services/CourseService";
import * as scoreService from "./services/ScoreService";
import { MetrixApiResponse, MetrixPlayerResult, TrackedPlayer, Change } from "../../types/metrix";
import { competition as MSG } from "../../config/messages";
import { HTML_NO_PREVIEW } from "../../config/bot";
import { updateProfiles } from "./playerProfiles";
import { startConversation, clearConversation } from "./llmCommentary";
import { computeAndApplySwaps, formatBagtagAnnouncement, getMissingTagPlayers } from "./bagtags";
import Logger from "js-logger";

const BASE_URL = "https://discgolfmetrix.com/api.php?content=result&id=";

export class Orchestrator {
  id: number;
  metrixId: string;
  chatId: number;
  following: boolean = true;
  snapshot: MetrixApiResponse | null = null;
  trackedPlayers: TrackedPlayer[] = [];

  private playersAnnounced: boolean;
  private poller: Poller | null = null;
  private commentaryQueue: Promise<void> = Promise.resolve();
  private endQueued: boolean = false;

  constructor(id: number, metrixId: string, chatId: number, playersAnnounced: boolean = false) {
    this.id = id;
    this.metrixId = metrixId;
    this.chatId = chatId;
    this.playersAnnounced = playersAnnounced;
  }

  async init(): Promise<this> {
    const { getData } = await import("../../shared/http");
    const initialSnapshot = await getData<MetrixApiResponse>(`${BASE_URL}${this.metrixId}`);

    if (!initialSnapshot?.Competition) {
      Logger.error(`Orchestrator ${this.metrixId}: invalid initial data`);
      this.following = false;
      return this;
    }

    this.snapshot = initialSnapshot;
    await this._refreshTrackedPlayers();

    Logger.info(`Started following: ${this.snapshot.Competition.Name} (${this.metrixId})`);

    if (this.trackedPlayers.length === 0) {
      if (this.playersAnnounced) {
        Logger.info(`${this.metrixId}: no tracked players on restore, continuing to poll`);
      } else {
        Logger.info(`${this.metrixId}: no tracked players, stopping`);
        await bot.api.sendMessage(this.chatId, MSG.followNoPlayers);
        this.following = false;
        return this;
      }
    }

    await this._announceIfNeeded();

    const initialDelay = this._msUntilStart(this.snapshot.Competition.Date);
    if (initialDelay > 0) {
      Logger.info(`${this.snapshot.Competition.Name} starts in ${Math.round(initialDelay / 60000)}min`);
    }

    startConversation(this.metrixId);

    this.poller = new Poller(this.metrixId, BASE_URL);
    this.poller.on("data", (snapshot: MetrixApiResponse) => this._onPollResult(snapshot));
    this.poller.on("fetchError", (err: Error) => Logger.error(`${this.metrixId}: ${err.message}`));
    this.poller.start(initialDelay);

    return this;
  }

  stopFollowing(): void {
    this.following = false;
    this.poller?.stop();
  }

  getScoreByPlayerName(name: string) {
    return this.snapshot?.Competition.Results.find(result => result.Name === name);
  }

  sendTopList(): void {
    this._sendTopList();
  }

  private async _onPollResult(freshSnapshot: MetrixApiResponse): Promise<void> {
    if (!this.following) return;

    try {
      // `this.snapshot === freshSnapshot` used to be part of this condition.
      // freshSnapshot is always a newly parsed JSON object, so it could never
      // be reference-equal to the stored one - the check never fired.
      if (!this.snapshot) {
        this.poller!.reportChanges(false);
        return;
      }

      const changes = detectChanges(this.snapshot, freshSnapshot, this.trackedPlayers);
      const hadChanges = changes.length > 0;

      if (hadChanges) {
        const capturedChanges = changes;
        const capturedResults = freshSnapshot.Competition.Results;
        // Captured alongside the changes rather than read inside the queued
        // callback. Commentary runs later, by which point `this.snapshot` has
        // already been replaced with a newer poll - the changes were captured
        // but the course name they were labelled with was not.
        const capturedCourseName = freshSnapshot.Competition.CourseName;
        this.commentaryQueue = this.commentaryQueue
          .then(() => this._sendCommentary(capturedChanges, capturedResults, capturedCourseName))
          .catch(err => Logger.error(`${this.metrixId}: commentary queue error: ${err.message}`));
      } else {
        Logger.debug(`${this.snapshot.Competition.Name} ${this.metrixId}: no changes`);
      }

      this.poller!.reportChanges(hadChanges);
      this.snapshot = freshSnapshot;
      await this._refreshTrackedPlayers();

      if (hasCompetitionEnded(this.trackedPlayers) && !this.endQueued) {
        this.endQueued = true;
        this.commentaryQueue = this.commentaryQueue
          .then(() => this._handleCompetitionEnd())
          .catch(err => Logger.error(`${this.metrixId}: end handler error: ${err.message}`));
      }

    } catch (err: any) {
      Logger.error(`Orchestrator ${this.metrixId}: ${err.message}`);
      this.poller!.reportChanges(false);
    }
  }

  private async _sendCommentary(changes: Change[], freshResults: MetrixPlayerResult[], courseName: string): Promise<void> {
    const message = await formatCommentaryMessage(changes, this.metrixId, courseName, freshResults, this.chatId);

    await bot.api.sendMessage(this.chatId, message, HTML_NO_PREVIEW);

    Logger.debug(`Changes in ${courseName}, ${this.metrixId}`);

    for (const change of changes) {
      await scoreService.saveSuperScore(change, this.chatId, this.id, courseName);
    }
  }

  private async _handleCompetitionEnd(): Promise<void> {
    this.following = false;
    this.poller!.stop();
    clearConversation(this.metrixId);

    Logger.info(`Game ${this.snapshot!.Competition.Name}, ${this.metrixId} is finished`);

    await bot.api.sendMessage(this.chatId, MSG.endSoon);
    await competitionService.markDone(this.id);

    const course = await courseService.getOrCreate(this.snapshot!.Competition.CourseName);
    if (course) {
      await scoreService.saveResults(this.trackedPlayers, this.chatId, course.id, this.id);
    }

    updateProfiles(this.chatId, this.trackedPlayers, this.snapshot!.Competition.Results);

    const bagtagResult = computeAndApplySwaps(this.chatId, this.trackedPlayers, this.snapshot!.Competition.Results);
    await bot.api.sendMessage(this.chatId, formatBagtagAnnouncement(bagtagResult), HTML_NO_PREVIEW);

    this._sendTopList();
  }

  private async _sendTopList(): Promise<void> {
    const message = formatTopList(this.snapshot!.Competition.Name, this.snapshot!.Competition.Results, this.trackedPlayers);
    await bot.api.sendMessage(this.chatId, message);
  }

  private async _refreshTrackedPlayers(): Promise<void> {
    const chatPlayers = await playerRepo.findByChatId(this.chatId);
    this.trackedPlayers = this.snapshot!.Competition.Results
      .filter(result => chatPlayers.find(chatPlayer => chatPlayer.name === result.Name))
      .map(result => {
        const chatPlayer = chatPlayers.find(chatPlayer => chatPlayer.name === result.Name)!;
        return { ...result, id: chatPlayer.id };
      });
  }

  private async _announceIfNeeded(): Promise<void> {
    if (this.trackedPlayers.length === 0 || this.playersAnnounced) return;
    const course = `<a href="https://discgolfmetrix.com/${this.metrixId}">${truncateCourseName(this.snapshot!.Competition.CourseName)}</a>`;
    let message = `Peliareenana toimii ${course}\n\nJa tällä kertaa kisassa on mukana:\n`;
    for (const player of this.trackedPlayers) message += `${player.Name}\n`;

    const missingTags = getMissingTagPlayers(this.chatId, this.trackedPlayers);
    if (missingTags.length > 0) {
      message += `\n🏷️ Ilman tägiä: ${missingTags.join(", ")}\nAseta: /bagtag set [nimi] [numero]`;
    }

    await bot.api.sendMessage(this.chatId, message, HTML_NO_PREVIEW);
    this.playersAnnounced = true;
  }

  private _msUntilStart(date: string): number {
    // Metrix date strings have no timezone info — they are in local Finnish time.
    // new Date() parses them as UTC, so we correct by the system's UTC offset.
    const offsetMs = new Date().getTimezoneOffset() * 60 * 1000; // negative for UTC+3
    const diff = new Date(date).getTime() + offsetMs - Date.now();
    return diff > 0 ? diff : 0;
  }
}
