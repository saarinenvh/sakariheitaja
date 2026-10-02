import { getRandom } from "./utils";
import { readConfig } from "../config";

// Searches Giphy for the given query and returns a random video/gif URL, or null if nothing found.
export async function searchGiphy(query: string): Promise<string | null> {
  const apiKey = readConfig().giphyApiKey;
  if (!apiKey) return null;

  const url =
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}` +
    `&q=${encodeURIComponent(query)}` +
    `&limit=10&rating=g&lang=fi`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const items: any[] = json?.data ?? [];
  if (!items.length) return null;

  const picked = items[getRandom(items.length)];
  return picked?.images?.original?.mp4 || picked?.images?.original?.url || null;
}
