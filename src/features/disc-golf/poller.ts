import EventEmitter from "events";
import { getData } from "../../shared/http";
import { MetrixApiResponse } from "../../types/metrix";
import Logger from "js-logger";
import { env } from "../../shared/env";
import { loggerSettings } from "../../shared/logger";
Logger.useDefaults(loggerSettings);

const INTERVAL_ACTIVE  = parseInt(env("POLL_INTERVAL_ACTIVE")  ?? "30000");
const INTERVAL_IDLE    = parseInt(env("POLL_INTERVAL_IDLE")    ?? "60000");
const INTERVAL_DORMANT = parseInt(env("POLL_INTERVAL_DORMANT") ?? "120000");
const ERROR_BASE       = 60_000;
const ERROR_MAX        = 600_000;
const IDLE_THRESHOLD    = 3;
const DORMANT_THRESHOLD = 10;

export default class Poller extends EventEmitter {
  private metrixId: string;
  private baseUrl: string;
  private running: boolean = false;
  private noChangeCount: number = 0;
  private errorCount: number = 0;
  private _timeoutId: NodeJS.Timeout | null = null;

  constructor(metrixId: string, baseUrl: string) {
    super();
    this.metrixId = metrixId;
    this.baseUrl = baseUrl;
  }

  start(initialDelay: number = 0): void {
    this.running = true;
    Logger.info(`Poller ${this.metrixId}: starting${initialDelay > 0 ? ` in ${Math.round(initialDelay / 1000)}s` : " now"}`);
    this._schedule(initialDelay);
  }

  stop(): void {
    this.running = false;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    Logger.info(`Poller ${this.metrixId}: stopped`);
  }

  reportChanges(hadChanges: boolean): void {
    if (hadChanges) {
      this.noChangeCount = 0;
    } else {
      this.noChangeCount++;
    }
  }

  private _schedule(delay: number): void {
    this._timeoutId = setTimeout(() => this._poll(), delay);
  }

  private async _poll(): Promise<void> {
    if (!this.running) return;

    let hadError = false;

    try {
      const data = await getData<MetrixApiResponse>(`${this.baseUrl}${this.metrixId}`);

      if (!data || !data.Competition) {
        hadError = true;
        this.errorCount++;
        Logger.warn(`Poller ${this.metrixId}: invalid/empty response (attempt ${this.errorCount}), backing off`);
      } else {
        this.errorCount = 0;
        this.emit("data", data);
      }
    } catch (err: any) {
      hadError = true;
      this.errorCount++;
      Logger.error(`Poller ${this.metrixId}: fetch error (attempt ${this.errorCount}): ${err.message}`);
      this.emit("fetchError", err);
    }

    if (!this.running) return;

    const nextInterval = hadError ? this._errorInterval() : this._activeInterval();
    Logger.debug(`Poller ${this.metrixId}: next poll in ${Math.round(nextInterval / 1000)}s [noChange=${this.noChangeCount}, errors=${this.errorCount}]`);
    this._schedule(nextInterval);
  }

  private _activeInterval(): number {
    if (this.noChangeCount < IDLE_THRESHOLD)    return this._jitter(INTERVAL_ACTIVE);
    if (this.noChangeCount < DORMANT_THRESHOLD) return this._jitter(INTERVAL_IDLE);
    return this._jitter(INTERVAL_DORMANT);
  }

  private _errorInterval(): number {
    const backoff = Math.min(ERROR_BASE * Math.pow(2, this.errorCount - 1), ERROR_MAX);
    return this._jitter(backoff);
  }

  private _jitter(ms: number): number {
    return Math.floor(ms * (1 + (Math.random() * 0.3 - 0.15)));
  }
}
