import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("../../../../shared/logger", () => ({ moduleLogger: () => ({ warn: mocks.warn }) }));

import { CommandContext, Context } from "grammy";
import { drawScorekeeper } from "../games";
import { gameMessages as MSG } from "../messages";

function command(match: string): { ctx: CommandContext<Context>; reply: ReturnType<typeof vi.fn> } {
  const reply = vi.fn().mockResolvedValue(undefined);
  // Only the fields the handler reads.
  return { ctx: { match, chat: { id: -100 }, reply } as unknown as CommandContext<Context>, reply };
}

function sent(reply: ReturnType<typeof vi.fn>): unknown[] {
  return reply.mock.calls.map(call => call[0]);
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.warn.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/kukakirjaa", () => {
  it("returns after the intro and counts down a step a second to the winner", async () => {
    const { ctx, reply } = command("Ville");

    await drawScorekeeper(ctx);
    expect(sent(reply)).toEqual([MSG.kukakirjaaIntro]);

    await vi.advanceTimersByTimeAsync(4000);
    expect(sent(reply)).toEqual([MSG.kukakirjaaIntro, "3", "2", "1", MSG.kukakirjaaWinner("VILLE")]);
  });

  it("logs a failed reply and sends nothing after it, without an unhandled rejection", async () => {
    const { ctx, reply } = command("Ville");
    reply.mockImplementation(async (text: string) => {
      if (text === "2") throw new Error("Forbidden: bot was kicked from the group chat");
    });

    await drawScorekeeper(ctx);
    await vi.advanceTimersByTimeAsync(4000);

    expect(sent(reply)).toEqual([MSG.kukakirjaaIntro, "3", "2"]);
    expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ chatId: -100 }), "scorekeeper countdown failed");
  });
});
