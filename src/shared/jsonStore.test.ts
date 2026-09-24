import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createJsonStore } from "./jsonStore";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "jsonstore-")); });

describe("createJsonStore", () => {
  it("round-trips data", () => {
    const path = join(dir, "s.json");
    const store = createJsonStore<Record<string, number>>(path, () => ({}));
    store.save({ matti: 7 });
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ matti: 7 });
    expect(createJsonStore<Record<string, number>>(path, () => ({})).load()).toEqual({ matti: 7 });
  });

  it("does not destroy a corrupt file when starting fresh", () => {
    const path = join(dir, "s.json");
    writeFileSync(path, '{"matti": 7, "pekka":', "utf-8");   // truncated mid-write

    const store = createJsonStore<Record<string, number>>(path, () => ({}));
    expect(store.load()).toEqual({});

    // The old behaviour returned {} and let the next save() overwrite the file.
    store.save({ jussi: 1 });

    const quarantined = readdirSync(dir).filter(f => f.includes(".corrupt-"));
    expect(quarantined).toHaveLength(1);
    expect(readFileSync(join(dir, quarantined[0]), "utf-8")).toBe('{"matti": 7, "pekka":');
  });

  it("leaves no partial file behind on the happy path", () => {
    const path = join(dir, "s.json");
    createJsonStore<Record<string, number>>(path, () => ({})).save({ a: 1 });
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it("serves repeat reads from cache rather than the disk", () => {
    const path = join(dir, "s.json");
    writeFileSync(path, JSON.stringify({ a: 1 }), "utf-8");
    const store = createJsonStore<Record<string, number>>(path, () => ({}));
    expect(store.load()).toEqual({ a: 1 });
    writeFileSync(path, JSON.stringify({ a: 999 }), "utf-8");   // changed underneath us
    expect(store.load()).toEqual({ a: 1 });
  });
});
