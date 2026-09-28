import { PublishedStanding } from "./commentaryAnalysis";
import { compareScorecards, ScoreChange } from "./commentaryFacts";
import { buildFactualCommentaryBrief, CommentarySnapshot, FactualCommentaryBrief } from "./factualCommentaryBrief";
import { CommentaryPromptContext, CommentaryText } from "./commentaryWriter";
import { buildCommentarySnapshot, MetrixRound, TrackedRoundPlayer } from "./metrixRound";
import { formatCommentaryMessages } from "./commentaryPresentation";
import { buildCompetitionFacts, CompetitionPlayerFact } from "./competitionFacts";

export interface CommentaryDelivery {
  write(context: CommentaryPromptContext): Promise<CommentaryText>;
  send(html: string): Promise<unknown>;
  saveScores(playerId: number, courseName: string, changes: readonly ScoreChange[]): Promise<void>;
  opening(): string;
  onError(error: unknown): void;
}

interface ObservedPlayer {
  sourceId: number | null;
  snapshot: CommentarySnapshot;
  recordedHoles: Set<number>;
}

interface PendingUpdate {
  previous: CommentarySnapshot;
  current: CommentarySnapshot;
  firstRecorded: readonly number[];
  competitionFacts: readonly CompetitionPlayerFact[];
}

interface ObservationBatch {
  layoutKey: string;
  resetPlayers: number[];
  updates: PendingUpdate[];
}

interface PendingPost {
  current: CommentarySnapshot;
  brief: FactualCommentaryBrief;
  text: string;
  newScores: readonly ScoreChange[];
}

export class RoundCommentary {
  private observed = new Map<number, ObservedPlayer>();
  private published = new Map<number, PublishedStanding>();
  private history = new Map<number, string[]>();
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
    this.history.clear();
  }

  private captureObservation(round: MetrixRound, tracked: readonly TrackedRoundPlayer[]): ObservationBatch {
    if (this.observedLayout !== round.layoutKey) this.observed.clear();
    this.observedLayout = round.layoutKey;
    const batch: ObservationBatch = { layoutKey: round.layoutKey, resetPlayers: [], updates: [] };
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
        batch.updates.push({ previous: previous.snapshot, current, firstRecorded,
          competitionFacts: buildCompetitionFacts(round, player.player) });
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
    if (this.publishedLayout !== batch.layoutKey) {
      this.published.clear();
      this.history.clear();
      this.publishedLayout = batch.layoutKey;
    }
    for (const playerId of batch.resetPlayers) {
      this.published.delete(playerId);
      this.history.delete(playerId);
    }
    const posts = await this.writePosts(batch.updates);
    const messages = formatCommentaryMessages(posts, this.metrixId, this.delivery.opening());
    for (const message of messages) {
      if (!this.active) return;
      await this.delivery.send(message.html);
      if (!this.active) return;
      for (const fragment of message.published) this.acknowledge(fragment.post, fragment.text);
      for (const { post, firstFragment } of message.published) {
        if (!firstFragment) continue;
        try {
          await this.delivery.saveScores(post.current.scope.playerId, post.current.courseName, post.newScores);
        } catch (error) {
          this.delivery.onError(error);
        }
      }
    }
  }

  private async writePosts(updates: readonly PendingUpdate[]): Promise<PendingPost[]> {
    const posts: PendingPost[] = [];
    for (const update of updates) {
      if (!this.active) break;
      const { current, previous } = update;
      const result = buildFactualCommentaryBrief({
        previousObserved: previous, current, lastPublished: this.published.get(current.scope.playerId) ?? null,
      });
      if (result.kind !== "ready") continue;
      const brief = result.brief;
      const commentary = await this.delivery.write({
        factualBrief: brief, competitionFacts: update.competitionFacts,
        narrativeHistory: [...(this.history.get(current.scope.playerId) ?? [])],
      });
      posts.push({
        current, brief, text: commentary.text,
        newScores: brief.changes.filter(change => change.kind === "recorded" && update.firstRecorded.includes(change.holeNumber)),
      });
    }
    return posts;
  }

  private acknowledge(post: PendingPost, deliveredText: string): void {
    const { scope, standing } = post.current;
    this.published.set(scope.playerId, { scope, standing });
    const history = this.history.get(scope.playerId) ?? [];
    history.push(deliveredText);
    this.history.set(scope.playerId, history);
  }
}
