import { existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import Logger from "js-logger";

// Small persistence helper for the bot's JSON-file state (bag tags, player
// profiles). These files are the only durable state outside MariaDB, and both
// used to be written with a plain whole-file writeFileSync and read back with a
// try/catch that returned {} on a parse failure. Two problems with that:
//
//   - A crash or container stop part-way through the write left truncated JSON.
//     The next load() swallowed it and returned an empty store, and the next
//     save() then wrote that empty store over the remains - one interrupted
//     write turned into every bag tag and every accumulated profile gone, with
//     a single warn line as the only trace.
//   - load() re-read and re-parsed the whole file on every single call, and
//     buildProfileSnippet calls it per player per hole.
export function createJsonStore<T extends object>(path: string, empty: () => T) {
  // Cached because this process is the only writer. A file edited by hand while
  // the bot is running won't be picked up until restart.
  let cache: T | null = null;

  function load(): T {
    if (cache) return cache;

    if (!existsSync(path)) {
      cache = empty();
      return cache;
    }

    try {
      cache = JSON.parse(readFileSync(path, "utf-8")) as T;
    } catch (err: any) {
      // Move the unreadable file aside instead of leaving it to be overwritten.
      // Starting fresh is survivable; silently destroying the only copy of the
      // data while doing so is not, and the contents may well be recoverable by
      // hand.
      const quarantined = `${path}.corrupt-${Date.now()}`;
      try {
        renameSync(path, quarantined);
        Logger.error(`${path} is not valid JSON, moved to ${quarantined} and starting fresh: ${err.message}`);
      } catch (moveErr: any) {
        Logger.error(`${path} is not valid JSON and could not be moved aside (${moveErr.message}); starting fresh WITHOUT overwriting it`);
      }
      cache = empty();
    }

    return cache;
  }

  function save(value: T): void {
    // Write-then-rename: rename is atomic within a filesystem, so a reader (or
    // a crash) sees either the old file or the complete new one, never a
    // half-written one.
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
    renameSync(tmp, path);
    cache = value;
  }

  return { load, save };
}
