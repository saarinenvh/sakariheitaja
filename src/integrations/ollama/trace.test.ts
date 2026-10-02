import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { createOllamaClient } from "./client";

vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const { generate } = createOllamaClient({ baseUrl: "http://ollama.test", model: "test-model", timeoutMs: 1000 });

describe("Ollama diagnostic traces", () => {
  const messages = [{ role: "user" as const, content: JSON.stringify({ factualBrief: { playerName: "Test" }, narrativeHistory: [] }) }];

  it("does not write files by default", async () => {
    vi.stubEnv("BOT_OLLAMA_TRACE", "false");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "Test" } }))));
    expect(await generate(messages)).toBe("Test");
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("captures the exact request and unprocessed response with provider usage", async () => {
    vi.stubEnv("BOT_OLLAMA_TRACE", "true");
    const response = { message: { content: "<think>reasoning</think>Test" }, prompt_eval_count: 123, eval_count: 12, done_reason: "stop" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generate(messages, { num_ctx: 8192 })).toBe("Test");
    const pending = JSON.parse(String(vi.mocked(writeFile).mock.calls[0][1]));
    const finished = JSON.parse(String(vi.mocked(writeFile).mock.calls[1][1]));
    expect(pending.state).toBe("pending");
    expect(finished.request).toEqual(JSON.parse(fetchMock.mock.calls[0][1].body));
    expect(finished.response).toEqual(response);
    expect(finished.id).toBe(pending.id);
    expect(vi.mocked(writeFile).mock.calls[1][2]).toEqual({ mode: 0o600 });
  });

  it("records transport failures without leaking exception messages", async () => {
    vi.stubEnv("BOT_OLLAMA_TRACE", "true");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("private endpoint")));
    await expect(generate(messages)).rejects.toThrow("private endpoint");
    const finished = String(vi.mocked(writeFile).mock.calls[1][1]);
    expect(JSON.parse(finished).error).toBe("TypeError");
    expect(finished).not.toContain("private endpoint");
  });

  it("preserves HTTP error bodies in the trace", async () => {
    vi.stubEnv("BOT_OLLAMA_TRACE", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(generate(messages)).rejects.toThrow("503");
    expect(JSON.parse(String(vi.mocked(writeFile).mock.calls[1][1]))).toMatchObject({ status: 503, response: "unavailable" });
  });

  it("does not interrupt inference when logging fails", async () => {
    vi.stubEnv("BOT_OLLAMA_TRACE", "true");
    vi.mocked(writeFile).mockRejectedValueOnce(new Error("disk full"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "Test" } }))));
    expect(await generate(messages)).toBe("Test");
  });
});
