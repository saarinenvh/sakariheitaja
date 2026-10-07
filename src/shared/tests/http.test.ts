import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));
vi.mock("../logger", () => ({ moduleLogger: () => ({ warn: mocks.warn, error: mocks.error }) }));

import { getData, httpGet } from "../http";

const URL_WITH_KEY = "https://api.example.com/search?api_key=secret";

function stubFetch(result: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpGet", () => {
  it("returns the body text, asking with a timeout and the bot's User-Agent", async () => {
    const fetchMock = stubFetch(new Response("<html>"));

    await expect(httpGet(URL_WITH_KEY)).resolves.toEqual({ kind: "ok", text: "<html>" });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { "User-Agent": expect.stringContaining("SakariHeitajaBot") },
      signal: expect.any(AbortSignal),
    });
  });

  it("adds the caller's headers to the User-Agent", async () => {
    const fetchMock = stubFetch(new Response("{}"));

    await httpGet(URL_WITH_KEY, { headers: { Accept: "application/json" } });

    expect(Object.keys(fetchMock.mock.calls[0][1].headers)).toEqual(["User-Agent", "Accept"]);
  });

  it("returns the status on an HTTP error", async () => {
    stubFetch(new Response("Too many requests", { status: 429 }));

    await expect(httpGet(URL_WITH_KEY)).resolves.toEqual({ kind: "http-error", status: 429 });
  });

  it("returns the reason when there's no answer in time, instead of throwing", async () => {
    stubFetch(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(httpGet(URL_WITH_KEY)).resolves.toEqual({ kind: "failed", reason: "The operation was aborted due to timeout" });
  });

  it("never logs the query string, where the API keys are", async () => {
    stubFetch(new Response("", { status: 500 }));
    await httpGet(URL_WITH_KEY);
    stubFetch(new Error("socket hang up"));
    await httpGet(URL_WITH_KEY);

    const logged = JSON.stringify([...mocks.warn.mock.calls, ...mocks.error.mock.calls]);
    expect(logged).toContain("https://api.example.com/search");
    expect(logged).not.toContain("secret");
  });
});

describe("getData", () => {
  it("parses the JSON body", async () => {
    stubFetch(new Response(JSON.stringify({ temp: 12 })));

    await expect(getData(URL_WITH_KEY)).resolves.toEqual({ temp: 12 });
  });

  it("returns undefined for an HTTP error, no answer, or a body that isn't JSON", async () => {
    stubFetch(new Response("", { status: 503 }));
    await expect(getData(URL_WITH_KEY)).resolves.toBeUndefined();

    stubFetch(new Error("socket hang up"));
    await expect(getData(URL_WITH_KEY)).resolves.toBeUndefined();

    stubFetch(new Response("<html>Maintenance</html>"));
    await expect(getData(URL_WITH_KEY)).resolves.toBeUndefined();
  });
});
