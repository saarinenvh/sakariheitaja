import { getRandom } from "../../shared/utils";

const SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const RESULTS_TO_PICK_FROM = 10;

export interface GiphyClient {
  /** A random video (or gif) URL among the top results for the query, or null without a key or a match. */
  searchGif(query: string): Promise<string | null>;
}

export function createGiphyClient(config: { apiKey: string | undefined }): GiphyClient {
  return { searchGif: query => searchGif(query, config.apiKey) };
}

async function searchGif(query: string, apiKey: string | undefined): Promise<string | null> {
  if (!apiKey) return null;

  const url =
    `${SEARCH_URL}?api_key=${apiKey}` +
    `&q=${encodeURIComponent(query)}` +
    `&limit=${RESULTS_TO_PICK_FROM}&rating=g&lang=fi`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const items: any[] = json?.data ?? [];
  if (!items.length) return null;

  const picked = items[getRandom(items.length)];
  return picked?.images?.original?.mp4 || picked?.images?.original?.url || null;
}
