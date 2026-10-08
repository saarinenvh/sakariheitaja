import dotenv from "dotenv";
import { z } from "zod";

// docker-compose passes an unset variable as "", so blank means unset everywhere.
const optionalText = z.string().optional().transform(value => (value === undefined || value.trim() === "" ? undefined : value));
const flag = optionalText.transform(value => value === "true");
const integerText = (isAllowed: (value: number) => boolean, requirement: string) =>
  optionalText.transform((text, context): number | undefined => {
    if (text === undefined) return undefined;
    const value = Number(text);
    if (Number.isInteger(value) && isAllowed(value)) return value;
    context.addIssue({ code: "custom", message: `must be ${requirement}, got "${text}"` });
    return z.NEVER;
  });
const positiveInteger = (fallback: number) =>
  integerText(value => value > 0, "a positive integer").transform(value => value ?? fallback);
const telegramChatId = integerText(() => true, "a Telegram chat id");

const DEFAULT_DB_HOST = "localhost";
const DEFAULT_DB_PORT = 3306;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3";
const DEFAULT_OLLAMA_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_ACTIVE_MS = 30_000;
const DEFAULT_POLL_INTERVAL_IDLE_MS = 60_000;
const DEFAULT_POLL_INTERVAL_DORMANT_MS = 120_000;
const DEFAULT_COMMENTARY_COUNTRY_CODE = "FI";
const DEFAULT_CHALLONGE_TOURNAMENT_URL = "https://challonge.com/yvept9b5";

const environmentSchema = z.object({
  TOKEN: optionalText,
  MORNING_CHAT_ID: telegramChatId,
  GAMES_CHAT_ID: telegramChatId,
  LLM_ENABLED: flag,
  NODE_ENV: optionalText,
  DATA_DIR: optionalText,
  DB_HOST: optionalText.transform(value => value ?? DEFAULT_DB_HOST),
  DB_PORT: positiveInteger(DEFAULT_DB_PORT),
  DB_USERNAME: optionalText,
  DB_PASSWORD: optionalText,
  DB_NAME: optionalText,
  OLLAMA_BASE_URL: optionalText.transform(value => value ?? DEFAULT_OLLAMA_BASE_URL),
  BOT_OLLAMA_MODEL: optionalText,
  OLLAMA_MODEL: optionalText,
  BOT_OLLAMA_TIMEOUT_MS: positiveInteger(DEFAULT_OLLAMA_TIMEOUT_MS),
  BOT_OLLAMA_TRACE: flag,
  POLL_INTERVAL_ACTIVE: positiveInteger(DEFAULT_POLL_INTERVAL_ACTIVE_MS),
  POLL_INTERVAL_IDLE: positiveInteger(DEFAULT_POLL_INTERVAL_IDLE_MS),
  POLL_INTERVAL_DORMANT: positiveInteger(DEFAULT_POLL_INTERVAL_DORMANT_MS),
  BOT_METRIX_INTEGRATION_CODE: optionalText,
  BOT_COMMENTARY_COUNTRY_CODE: optionalText.transform(value => value ?? DEFAULT_COMMENTARY_COUNTRY_CODE),
  OPENWEATHERMAP_APIKEY: optionalText,
  GIPHY_API_KEY: optionalText,
  CHALLONGE_TOURNAMENT_URL: optionalText.transform(value => value ?? DEFAULT_CHALLONGE_TOURNAMENT_URL),
  CHALLONGE_API_KEY: optionalText,
  VITEST: flag,
});

export interface AppConfig {
  /** `gamesChatId`: the group whose game plans the morning greeting lists. */
  telegram: { token: string | undefined; morningChatId: number | undefined; gamesChatId: number | undefined };
  llmEnabled: boolean;
  dataDir: string | undefined;
  database: { host: string; port: number; username?: string; password?: string; name?: string; logQueries: boolean };
  ollama: { baseUrl: string; model: string; timeoutMs: number; trace: boolean };
  polling: { activeIntervalMs: number; idleIntervalMs: number; dormantIntervalMs: number };
  metrix: { integrationCode: string | undefined; commentaryCountryCode: string };
  openWeatherMapApiKey: string | undefined;
  giphyApiKey: string | undefined;
  challonge: { tournamentUrl: string; apiKey: string | undefined };
  logging: { pretty: boolean; level: "debug" | "silent" };
}

/**
 * The only reader of process.env. Read on every call, so tests and the eval harness can set variables
 * before the code that uses them runs; main.ts reads it once at startup so a bad value fails there.
 */
export function readConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = parseEnvironment(source);
  return {
    telegram: { token: environment.TOKEN, morningChatId: environment.MORNING_CHAT_ID, gamesChatId: environment.GAMES_CHAT_ID },
    llmEnabled: environment.LLM_ENABLED,
    dataDir: environment.DATA_DIR,
    database: {
      host: environment.DB_HOST, port: environment.DB_PORT,
      username: environment.DB_USERNAME, password: environment.DB_PASSWORD, name: environment.DB_NAME,
      logQueries: environment.NODE_ENV === "development",
    },
    ollama: {
      baseUrl: environment.OLLAMA_BASE_URL,
      model: environment.BOT_OLLAMA_MODEL ?? environment.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
      timeoutMs: environment.BOT_OLLAMA_TIMEOUT_MS,
      trace: environment.BOT_OLLAMA_TRACE,
    },
    polling: {
      activeIntervalMs: environment.POLL_INTERVAL_ACTIVE,
      idleIntervalMs: environment.POLL_INTERVAL_IDLE,
      dormantIntervalMs: environment.POLL_INTERVAL_DORMANT,
    },
    metrix: {
      integrationCode: environment.BOT_METRIX_INTEGRATION_CODE,
      commentaryCountryCode: environment.BOT_COMMENTARY_COUNTRY_CODE,
    },
    openWeatherMapApiKey: environment.OPENWEATHERMAP_APIKEY,
    giphyApiKey: environment.GIPHY_API_KEY,
    challonge: { tournamentUrl: environment.CHALLONGE_TOURNAMENT_URL, apiKey: environment.CHALLONGE_API_KEY },
    // Tests stay quiet; pino-pretty's worker thread is just noise there.
    logging: { pretty: !environment.VITEST, level: environment.VITEST ? "silent" : "debug" },
  };
}

function parseEnvironment(source: NodeJS.ProcessEnv): z.output<typeof environmentSchema> {
  const result = environmentSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`);
  throw new Error(`Invalid configuration: ${problems.join("; ")}`);
}

/** Loads `ENV_FILE` (default `.env`) into the environment; main.ts calls it before anything reads config. */
export function loadEnvironmentFile(): void {
  dotenv.config({ path: process.env.ENV_FILE ?? ".env" });
}

/** Settings without which the bot can't start; checked once by main.ts. */
export function requireStartupConfig(config: AppConfig): AppConfig & { telegram: { token: string } } {
  const token = config.telegram.token;
  if (token === undefined) throw new Error("TOKEN is not set");
  return { ...config, telegram: { ...config.telegram, token } };
}
