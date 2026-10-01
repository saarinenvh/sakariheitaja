import { readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { z } from "zod";
import { parseOrThrow } from "../../src/util/validation";

export const FIXTURE_DIR = join(process.cwd(), "scripts", "eval-commentary", "fixtures");
const FIXTURE_EXTENSION = ".json";

const integerLike = z.union([z.number().int(), z.string().regex(/^-?\d+$/).transform(Number)]);
const optionalIntegerLike = z.union([integerLike, z.literal(""), z.null()]).optional()
  .transform(value => (value === undefined || value === "" ? null : value));

export const holeSchema = z.union([
  // Metrix reports OB as PEN or OB; keep both so the replay sees the same penalty as the bot.
  z.object({ Result: integerLike, Diff: optionalIntegerLike, PEN: optionalIntegerLike, OB: optionalIntegerLike }),
  z.array(z.never()).length(0),
]);

export const playerSchema = z.object({
  Name: z.string(),
  ClassName: z.string().nullish().transform(value => value ?? ""),
  Group: z.string().nullish().transform(value => value ?? ""),
  DNF: z.union([z.string(), z.number(), z.boolean()]).nullish().transform(value => value ?? null),
  PlayerResults: z.array(holeSchema),
});

export const trackSchema = z.object({
  Number: integerLike,
  NumberAlt: z.string().nullish().transform(value => value ?? ""),
  Par: optionalIntegerLike,
});

const weatherSchema = z.object({
  temperatureC: z.number(),
  windSpeedMs: z.number().nonnegative(),
  windFromDeg: z.number().min(0).max(360).nullable().default(null),
  description: z.string().min(1),
  precipitationMmPerHour: z.number().nonnegative().nullable(),
});

// Course data as Metrix returned it (layout API response, parsed statistics); public course information, never the key.
const courseSchema = z.object({
  courseId: z.string(),
  detailsResponse: z.unknown().nullable(),
  statistics: z.unknown().nullable(),
});

const fixtureSchema = z.object({
  description: z.string(),
  courseName: z.string(),
  date: z.string(),
  tracked: z.array(z.string().min(1)).min(1),
  weather: z.object({ start: weatherSchema, halfway: weatherSchema }),
  tracks: z.array(trackSchema).min(1),
  players: z.array(playerSchema).min(1),
  course: courseSchema.nullable().default(null),
});

export type FixtureHole = z.output<typeof holeSchema>;
export type FixturePlayer = z.output<typeof playerSchema>;
export type FixtureTrack = z.output<typeof trackSchema>;
export type FixtureWeather = z.output<typeof weatherSchema>;
export type FixtureCourse = z.output<typeof courseSchema>;
export type CommentaryFixture = z.output<typeof fixtureSchema> & { name: string };

export function loadFixtures(names: readonly string[]): CommentaryFixture[] {
  const available = readdirSync(FIXTURE_DIR).filter(file => file.endsWith(FIXTURE_EXTENSION))
    .map(file => basename(file, FIXTURE_EXTENSION));
  const selected = names.length > 0 ? names : available;
  for (const name of selected) {
    if (!available.includes(name)) throw new Error(`Unknown fixture "${name}". Available: ${available.join(", ")}`);
  }
  return selected.map(name => ({ name, ...parseOrThrow(fixtureSchema, readJson(fixturePath(name)), `fixture ${name}`) }));
}

export function saveFixture(fixture: CommentaryFixture): string {
  const { name, ...content } = fixture;
  const path = fixturePath(name);
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
  return path;
}

function fixturePath(name: string): string {
  return join(FIXTURE_DIR, `${name}${FIXTURE_EXTENSION}`);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}
