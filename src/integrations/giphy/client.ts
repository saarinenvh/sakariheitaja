import { getData } from "../../shared/http";
import { getRandom } from "../../shared/utils";
import { parseOrThrow } from "../../shared/validation";
import { gifSearchSchema } from "./schema";

const SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const RESULTS_TO_PICK_FROM = 10;

export interface GiphyClient {
  /** A random video (or gif) URL among the top results for the query; null without a key, a match or an answer in time. */
  searchGif(query: string): Promise<string | null>;
}

export function createGiphyClient(config: { apiKey: string | undefined }): GiphyClient {
  return { searchGif: query => searchGif(query, config.apiKey) };
}

async function searchGif(query: string, apiKey: string | undefined): Promise<string | null> {
  if (!apiKey) return null;

  const payload = await getData(buildSearchUrl(query, apiKey));
  if (payload === undefined) return null;

  const items = parseOrThrow(gifSearchSchema, payload, "Giphy search").data ?? [];
  if (!items.length) return null;

  const picked = items[getRandom(items.length)];
  return picked.images?.original?.mp4 || picked.images?.original?.url || null;
}

/** The top results for the query, family-friendly, in Finnish. */
function buildSearchUrl(query: string, apiKey: string): string {
  return `${SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`
    + `&limit=${RESULTS_TO_PICK_FROM}&rating=g&lang=fi`;
}
