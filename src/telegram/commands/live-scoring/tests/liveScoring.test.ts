import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), registryRemove: vi.fn() }));
vi.mock("../../../../features/live-scoring/competitions", () => ({ remove: mocks.remove, start: vi.fn() }));
vi.mock("../../../../features/live-scoring/trackerRegistry", () => ({ remove: mocks.registryRemove }));

import { CommandContext, Context } from "grammy";
import { stopFollowing } from "../liveScoring";

function command(match: string): { ctx: CommandContext<Context>; reply: ReturnType<typeof vi.fn> } {
  const reply = vi.fn().mockResolvedValue(undefined);
  // Only the fields the handler reads.
  return { ctx: { match, chat: { id: -100 }, reply } as unknown as CommandContext<Context>, reply };
}

describe("/lopeta", () => {
  it("asks for the Metrix id it takes, not an internal competition id", async () => {
    const { ctx, reply } = command("");
    await stopFollowing(ctx);
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("metrixId"));
  });

  it("stops the round with that Metrix id", async () => {
    mocks.registryRemove.mockReturnValue({ id: 7 });
    const { ctx } = command("3809486");
    await stopFollowing(ctx);
    expect(mocks.registryRemove).toHaveBeenCalledWith(-100, "3809486");
    expect(mocks.remove).toHaveBeenCalledWith("7");
  });
});
