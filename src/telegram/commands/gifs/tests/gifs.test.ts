import { describe, expect, it, vi } from "vitest";
import { CommandContext, Context } from "grammy";
import { sendGif } from "../gifs";
import { GiphyClient } from "../../../../integrations/giphy/client";

function command(match: string) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const replyWithAnimation = vi.fn().mockResolvedValue(undefined);
  // Only the fields the handler reads.
  const ctx = { match, reply, replyWithAnimation } as unknown as CommandContext<Context>;
  return { ctx, reply, replyWithAnimation };
}

function giphyReturning(url: string | null): GiphyClient {
  return { searchGif: vi.fn().mockResolvedValue(url) };
}

describe("/gif", () => {
  it("sends Giphy's result as an animation, a plain GIF included", async () => {
    const { ctx, replyWithAnimation } = command("kissa");

    await sendGif(ctx, giphyReturning("https://media.giphy.test/kissa.gif"));

    expect(replyWithAnimation).toHaveBeenCalledWith("https://media.giphy.test/kissa.gif");
  });

  it("sends nothing when Giphy finds nothing", async () => {
    const { ctx, reply, replyWithAnimation } = command("kissa");

    await sendGif(ctx, giphyReturning(null));

    expect(replyWithAnimation).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });
});
