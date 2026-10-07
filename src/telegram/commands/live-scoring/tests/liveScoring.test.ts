import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartResult, TrackerDependencies } from "../../../../features/live-scoring";

const mocks = vi.hoisted(() => ({
  create: vi.fn<(chatId: number, metrixId: string) => Promise<{ insertId: number }>>(),
  deleteById: vi.fn<(id: number) => Promise<void>>(),
  start: vi.fn<() => Promise<StartResult>>(),
}));

vi.mock("../../../../features/live-scoring/db/competitionRepository", () => ({ deleteById: mocks.deleteById }));
vi.mock("../../../../features/live-scoring/liveScoring", () => ({
  registerCompetition: (chatId: number, _chatName: string, metrixId: string) => mocks.create(chatId, metrixId),
  ScoreTracker: class {
    stopped = false;
    started = false;
    constructor(public id: number, public metrixId: string, public chatId: number) {}
    async start(): Promise<StartResult> {
      const result = await mocks.start();
      this.started = result.kind === "following";
      return result;
    }
    stopFollowing(): void {
      this.stopped = true;
      this.started = false;
    }
  },
}));

import { CommandContext, Context } from "grammy";
import { follow, formatFollowedRounds, stopFollowing } from "../liveScoring";
import { liveScoringCommandMessages as MSG } from "../messages";
import * as registry from "../../../../features/live-scoring/trackerRegistry";

const METRIX_ID = "3809486";
// The handlers don't touch the dependencies; the fake tracker ignores them.
const dependencies = {} as TrackerDependencies;

// Each test gets its own chat, since the registry lives for the whole file.
let chatId = -100;

function command(match: string): { ctx: CommandContext<Context>; reply: ReturnType<typeof vi.fn> } {
  const reply = vi.fn().mockResolvedValue(undefined);
  // Only the fields the handlers read.
  return { ctx: { match, chat: { id: chatId, title: "Testi" }, reply } as unknown as CommandContext<Context>, reply };
}

/** The registry's view of the round, when the handler replied. */
function trackedAtReply(reply: ReturnType<typeof vi.fn>): () => boolean {
  let tracked = false;
  reply.mockImplementation(async () => { tracked = registry.findTracked(chatId, METRIX_ID) !== undefined; });
  return () => tracked;
}

beforeEach(() => {
  chatId--;
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ insertId: 7 });
  mocks.deleteById.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue({ kind: "following" });
});

describe("/follow", () => {
  it("adds the round to the registry before confirming", async () => {
    const { ctx, reply } = command(METRIX_ID);
    const tracked = trackedAtReply(reply);

    await follow(ctx, dependencies);

    expect(reply).toHaveBeenCalledWith(MSG.followStarted);
    expect(tracked()).toBe(true);
  });

  it("doesn't follow a round the chat already follows", async () => {
    await follow(command(METRIX_ID).ctx, dependencies);
    const { ctx, reply } = command(METRIX_ID);

    await follow(ctx, dependencies);

    expect(reply).toHaveBeenCalledWith(MSG.followAlready);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("lets only one of two simultaneous /follows start the round", async () => {
    const first = command(METRIX_ID);
    const second = command(METRIX_ID);

    await Promise.all([follow(first.ctx, dependencies), follow(second.ctx, dependencies)]);

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(MSG.followAlready);
  });

  it("deletes the competition before saying the round couldn't start, and frees the round", async () => {
    mocks.start.mockResolvedValueOnce({ kind: "invalid", error: new Error("private round") });
    const { ctx, reply } = command(METRIX_ID);
    reply.mockImplementation(async () => { expect(mocks.deleteById).toHaveBeenCalledWith(7); });

    await follow(ctx, dependencies);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("Mitä sä säädät"));
    expect(registry.findTracked(chatId, METRIX_ID)).toBeUndefined();
    await follow(command(METRIX_ID).ctx, dependencies);
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("deletes the competition and frees the round when starting throws", async () => {
    mocks.start.mockRejectedValueOnce(new Error("database offline"));

    await expect(follow(command(METRIX_ID).ctx, dependencies)).rejects.toThrow("database offline");

    expect(mocks.deleteById).toHaveBeenCalledWith(7);
    expect(registry.reserve(chatId, METRIX_ID)).toBe(true);
  });
});

describe("/lopeta", () => {
  it("asks for the Metrix id it takes, not an internal competition id", async () => {
    const { ctx, reply } = command("");

    await stopFollowing(ctx);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("metrixId"));
  });

  it("deletes the competition and stops the round before confirming", async () => {
    await follow(command(METRIX_ID).ctx, dependencies);
    const tracker = registry.findTracked(chatId, METRIX_ID);
    const { ctx, reply } = command(METRIX_ID);
    const tracked = trackedAtReply(reply);

    await stopFollowing(ctx);

    expect(mocks.deleteById).toHaveBeenCalledWith(7);
    expect(tracker?.stopped).toBe(true);
    expect(tracked()).toBe(false);
    expect(reply).toHaveBeenCalledWith(MSG.lopetaOk);
  });

  it("keeps following when deleting the competition fails", async () => {
    await follow(command(METRIX_ID).ctx, dependencies);
    mocks.deleteById.mockRejectedValueOnce(new Error("database offline"));
    const { ctx, reply } = command(METRIX_ID);

    await expect(stopFollowing(ctx)).rejects.toThrow("database offline");

    expect(registry.findTracked(chatId, METRIX_ID)?.stopped).toBe(false);
    expect(reply).not.toHaveBeenCalled();
  });

  it("stops a resumed round that is still retrying its start", async () => {
    const { ScoreTracker } = await import("../../../../features/live-scoring/liveScoring");
    const retrying = new ScoreTracker(9, METRIX_ID, chatId, dependencies);
    registry.add(chatId, retrying);

    await stopFollowing(command(METRIX_ID).ctx);

    expect(mocks.deleteById).toHaveBeenCalledWith(9);
    expect(retrying.stopped).toBe(true);
  });

  it("says so when the chat doesn't follow that round", async () => {
    const { ctx, reply } = command(METRIX_ID);

    await stopFollowing(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.lopetaNotFound);
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });
});

describe("/pelit", () => {
  const ongoing = { metrixId: "3809486", name: "Kevät & kiekko", playerCount: 4, startsAt: new Date("2026-10-07T07:00:00Z") };
  const upcoming = { metrixId: "3811200", name: "Viikkokisa", playerCount: 3, startsAt: new Date("2026-10-11T07:00:00Z") };

  it("says so when nothing is followed", () => {
    expect(formatFollowedRounds([], [])).toBe(MSG.pelitNone);
  });

  it("lists the rounds being played, then the upcoming ones with their Helsinki start time", () => {
    expect(formatFollowedRounds([ongoing], [upcoming])).toBe(
      `${MSG.pelitHeader}3809486: Kevät &amp; kiekko, 4 sankari(a). https://discgolfmetrix.com/3809486\n\n`
      + `${MSG.pelitUpcoming}3811200: Viikkokisa, su 11.10. klo 10.00, 3 sankari(a). https://discgolfmetrix.com/3811200`,
    );
  });

  it("shows only the upcoming section when nothing is being played yet", () => {
    expect(formatFollowedRounds([], [upcoming]).startsWith(MSG.pelitUpcoming)).toBe(true);
  });
});
