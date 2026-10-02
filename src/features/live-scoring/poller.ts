import EventEmitter from "events";
import { RoundFetchResult } from "../../integrations/metrix/client";
import { moduleLogger } from "../../shared/logger";
import { readConfig } from "../../config";

const log = moduleLogger("poller");

const {
  activeIntervalMs: INTERVAL_ACTIVE, idleIntervalMs: INTERVAL_IDLE, dormantIntervalMs: INTERVAL_DORMANT,
} = readConfig().polling;
const ERROR_BASE       = 60_000;
const ERROR_MAX        = 600_000;
const IDLE_THRESHOLD    = 3;
const DORMANT_THRESHOLD = 10;

export default class Poller extends EventEmitter {
  private metrixId: string;
  private fetchRound: () => Promise<RoundFetchResult>;
  private running: boolean = false;
  private noChangeCount: number = 0;
  private errorCount: number = 0;
  private _timeoutId: NodeJS.Timeout | null = null;

  /** Emits "data" with each answered fetch (parsed or invalid); a failed request backs off instead. */
  constructor(metrixId: string, fetchRound: () => Promise<RoundFetchResult>) {
    super();
    this.metrixId = metrixId;
    this.fetchRound = fetchRound;
  }

  start(initialDelay: number = 0): void {
    this.running = true;
    log.info({ metrixId: this.metrixId, delayS: Math.round(initialDelay / 1000) }, "starting");
    this._schedule(initialDelay);
  }

  stop(): void {
    this.running = false;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    log.info({ metrixId: this.metrixId }, "stopped");
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
      const result = await this.fetchRound();

      if (result.kind === "unavailable") {
        hadError = true;
        this.errorCount++;
        log.warn({ metrixId: this.metrixId, attempt: this.errorCount }, "round request failed, backing off");
      } else {
        this.errorCount = 0;
        this.emit("data", result);
      }
    } catch (err: any) {
      hadError = true;
      this.errorCount++;
      log.error({ metrixId: this.metrixId, attempt: this.errorCount, err }, "fetch error");
      this.emit("fetchError", err);
    }

    if (!this.running) return;

    const nextInterval = hadError ? this._errorInterval() : this._activeInterval();
    log.debug({
      metrixId: this.metrixId, nextPollS: Math.round(nextInterval / 1000), noChange: this.noChangeCount, errors: this.errorCount,
    }, "next poll scheduled");
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
