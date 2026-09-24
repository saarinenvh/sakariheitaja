import Logger from "js-logger";

const HEADERS = { "User-Agent": "SakariHeitajaBot/1.0 (disc golf commentary bot)" };

// Every outbound call in the bot goes through this module, and it previously
// had no timeout at all. Poller only schedules its next poll once the current
// one settles, so a single hung Metrix request stopped that competition being
// polled permanently - no error, no backoff, nothing in the logs.
const DEFAULT_TIMEOUT_MS = 10_000;

// Query strings here carry API keys (OpenWeatherMap's appid, Giphy's api_key),
// so only ever log the path.
function safeUrl(url: string): string {
  return url.split("?")[0];
}

export async function getData<T = any>(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T | undefined> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });

    // Previously unchecked - an upstream 500 or a rate-limit page was handed
    // back to callers as if it were data.
    if (!response.ok) {
      Logger.warn(`getData ${safeUrl(url)}: HTTP ${response.status}`);
      return undefined;
    }

    // Note the await: this used to be `return response.json()` INSIDE the try,
    // which returns the promise rather than awaiting it - so a JSON parse
    // failure (an HTML error page, a truncated response) escaped this catch
    // entirely and rejected at the caller instead.
    return await response.json() as T;
  } catch (error: any) {
    Logger.error(`getData ${safeUrl(url)} failed: ${error.message}`);
    return undefined;
  }
}

export async function getGiphy(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      Logger.warn(`getGiphy ${safeUrl(url)}: HTTP ${response.status}`);
      return undefined;
    }
    return await response.text();
  } catch (error: any) {
    Logger.error(`getGiphy ${safeUrl(url)} failed: ${error.message}`);
    return undefined;
  }
}
