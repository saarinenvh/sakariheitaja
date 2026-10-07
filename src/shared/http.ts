import { moduleLogger } from "./logger";

const log = moduleLogger("http");

const HEADERS = { "User-Agent": "SakariHeitajaBot/1.0 (disc golf commentary bot)" };

/**
 * How long a request may take. The poller schedules its next poll only once the current one
 * settles, so a hung request without a timeout would stop a round being polled.
 */
const HTTP_TIMEOUT_MS = 10_000;

export interface HttpGetOptions {
  /** Merged over the default User-Agent. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** How a request went. `failed`: no answer in time, or a network error. */
export type HttpResult =
  | { kind: "ok"; text: string }
  | { kind: "http-error"; status: number }
  | { kind: "failed"; reason: string };

/** One GET with a timeout. Never throws: a failure is logged and comes back as a result. */
export async function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpResult> {
  const { headers = {}, timeoutMs = HTTP_TIMEOUT_MS } = options;

  try {
    const response = await fetch(url, { headers: { ...HEADERS, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      log.warn({ url: safeUrl(url), status: response.status }, "HTTP error");
      return { kind: "http-error", status: response.status };
    }

    return { kind: "ok", text: await response.text() };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error({ url: safeUrl(url), reason }, "request failed");
    return { kind: "failed", reason };
  }
}

/** The JSON body, or undefined on any failure (logged): no answer in time, an HTTP error, a body that isn't JSON. */
export async function getData(url: string): Promise<unknown> {
  const result = await httpGet(url);
  if (result.kind !== "ok") return undefined;

  try {
    return JSON.parse(result.text);
  } catch (error) {
    log.error({ url: safeUrl(url), err: error }, "response isn't JSON");
    return undefined;
  }
}

/** Query strings carry API keys, so logs get only the path. */
function safeUrl(url: string): string {
  return url.split("?")[0];
}
