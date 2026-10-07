import { afterEach, describe, expect, it, vi } from "vitest";
import { createGiphyClient } from "../client";

const client = createGiphyClient({ apiKey: "key" });

afterEach(() => vi.unstubAllGlobals());

describe("Giphy client", () => {
  it("picks a video among the results", async () => {
    const result = { images: { original: { mp4: "https://media.giphy.com/a.mp4", url: "https://media.giphy.com/a.gif" } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [result] }))));

    await expect(client.searchGif("frolf")).resolves.toBe("https://media.giphy.com/a.mp4");
  });

  it("returns null when Giphy doesn't answer in time, so the caller goes on without a gif", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.searchGif("frolf")).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("returns null on an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await expect(client.searchGif("frolf")).resolves.toBeNull();
  });
});
