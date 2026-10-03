import { describe, expect, it } from "vitest";
import { readConfig, requireStartupConfig } from "../config";

describe("readConfig", () => {
  it("uses the defaults when nothing is set", () => {
    const config = readConfig({});
    expect(config.database).toMatchObject({ host: "localhost", port: 3306, logQueries: false });
    expect(config.ollama).toEqual({ baseUrl: "http://127.0.0.1:11434", model: "llama3", timeoutMs: 120_000, trace: false });
    expect(config.polling).toEqual({ activeIntervalMs: 30_000, idleIntervalMs: 60_000, dormantIntervalMs: 120_000 });
    expect(config.metrix.commentaryCountryCode).toBe("FI");
    expect(config.llmEnabled).toBe(false);
  });

  it("treats a blank value as unset, as docker-compose passes unset variables", () => {
    const config = readConfig({ POLL_INTERVAL_ACTIVE: "", DB_HOST: "  ", BOT_METRIX_INTEGRATION_CODE: "" });
    expect(config.polling.activeIntervalMs).toBe(30_000);
    expect(config.database.host).toBe("localhost");
    expect(config.metrix.integrationCode).toBeUndefined();
  });

  it("reads set values, with the bot's own Ollama model taking precedence", () => {
    const config = readConfig({
      LLM_ENABLED: "true", BOT_OLLAMA_TRACE: "1", BOT_OLLAMA_MODEL: "gemma4", OLLAMA_MODEL: "qwen3",
      POLL_INTERVAL_IDLE: "45000", MORNING_CHAT_ID: "-100123", NODE_ENV: "development",
    });
    expect(config.llmEnabled).toBe(true);
    expect(config.ollama).toMatchObject({ model: "gemma4", trace: false });
    expect(config.polling.idleIntervalMs).toBe(45_000);
    expect(config.telegram.morningChatId).toBe(-100123);
    expect(config.database.logQueries).toBe(true);
    expect(readConfig({ OLLAMA_MODEL: "qwen3" }).ollama.model).toBe("qwen3");
  });

  it("names the variable when a number is invalid instead of using NaN", () => {
    expect(() => readConfig({ POLL_INTERVAL_ACTIVE: "fast" })).toThrow(/POLL_INTERVAL_ACTIVE must be a positive integer, got "fast"/);
    expect(() => readConfig({ DB_PORT: "0" })).toThrow(/DB_PORT/);
    expect(() => readConfig({ MORNING_CHAT_ID: "chat" })).toThrow(/MORNING_CHAT_ID/);
  });
});

describe("requireStartupConfig", () => {
  it("requires the Telegram token", () => {
    expect(() => requireStartupConfig(readConfig({}))).toThrow("TOKEN is not set");
    expect(requireStartupConfig(readConfig({ TOKEN: "123:abc" })).telegram.token).toBe("123:abc");
  });
});
