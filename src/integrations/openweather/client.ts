import { getData } from "../../shared/http";

// The connection to OpenWeatherMap: base URL, API key and the query every request shares. The
// endpoints, their parsing and the bot's types are in api.ts.

const BASE_URL = "https://api.openweathermap.org/data/2.5";
/** Metric units and Finnish descriptions on every request. */
const SHARED_QUERY = { units: "metric", lang: "fi" };

/** A JSON body, or why there's none: no API key, or the request failed (logged by `shared/http`). */
export type OpenWeatherResponse =
  | { kind: "ok"; body: unknown }
  | { kind: "failed"; reason: string };

export interface OpenWeatherClient {
  /** GET `path` (e.g. "/weather") with the endpoint's query; never throws. */
  get(path: string, query: Record<string, string>): Promise<OpenWeatherResponse>;
}

export function createOpenWeatherClient(config: { apiKey: string | undefined }): OpenWeatherClient {
  return { get: (path, query) => get(path, query, config.apiKey) };
}

async function get(path: string, query: Record<string, string>, apiKey: string | undefined): Promise<OpenWeatherResponse> {
  if (!apiKey) return { kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" };

  const body = await getData(buildUrl(path, query, apiKey));
  if (body === undefined) return { kind: "failed", reason: "OpenWeatherMap request failed" };

  return { kind: "ok", body };
}

function buildUrl(path: string, query: Record<string, string>, apiKey: string): string {
  const params = new URLSearchParams({ ...query, ...SHARED_QUERY, appid: apiKey });
  return `${BASE_URL}${path}?${params.toString()}`;
}
