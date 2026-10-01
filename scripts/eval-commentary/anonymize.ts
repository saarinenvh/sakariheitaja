import { z } from "zod";
import { parseOrThrow } from "../../src/util/validation";
import { CommentaryFixture, FixtureCourse, FixtureWeather, playerSchema, trackSchema } from "./fixtureFile";

const FAKE_FIRST_NAMES = [
  "Aatu", "Eero", "Juho", "Lauri", "Mikko", "Niilo", "Onni", "Paavo", "Risto", "Santeri", "Topi", "Urho",
  "Veeti", "Aleksi", "Elias", "Jere", "Kalle", "Leevi", "Matias", "Oskari", "Pyry", "Rasmus", "Severi",
  "Tuomas", "Väinö", "Arttu", "Henri", "Jesse", "Konsta", "Miro",
] as const;
const FAKE_SURNAMES = [
  "Ahonen", "Heikkilä", "Järvinen", "Koskinen", "Laine", "Lehtonen", "Mäkinen", "Niemi", "Ojala", "Peltonen",
  "Rantanen", "Salminen", "Toivonen", "Vainio", "Virtanen", "Hämäläinen", "Kallio", "Kettunen", "Lindholm",
  "Mustonen", "Nurmi", "Pesonen", "Rinne", "Saarela", "Tuominen", "Uotila", "Vesala", "Aaltonen", "Kivelä", "Lampi",
] as const;

const DEFAULT_WEATHER: { start: FixtureWeather; halfway: FixtureWeather } = {
  start: { temperatureC: 14, windSpeedMs: 4, windFromDeg: 225, description: "puolipilvistä", precipitationMmPerHour: null },
  halfway: { temperatureC: 10, windSpeedMs: 8, windFromDeg: 270, description: "kevyt sade", precipitationMmPerHour: 0.6 },
};

const metrixResponseSchema = z.object({
  Competition: z.object({
    CourseID: z.union([z.string(), z.number()]).nullish().transform(value => (value === null || value === undefined ? null : String(value))),
    CourseName: z.string(),
    Date: z.string(),
    Tracks: z.array(trackSchema).min(1),
    Results: z.array(playerSchema).min(1),
  }),
});

export interface FixtureRequest {
  name: string;
  description: string;
  trackedRealNames: readonly string[];
  course: FixtureCourse | null;
}

export function readCourseId(response: unknown): string | null {
  return parseOrThrow(metrixResponseSchema, response, "Metrix round for fixture").Competition.CourseID;
}

/** Builds a fixture from a Metrix result response with every player name replaced consistently. */
export function buildAnonymizedFixture(response: unknown, request: FixtureRequest): CommentaryFixture {
  const { Competition: round } = parseOrThrow(metrixResponseSchema, response, "Metrix round for fixture");
  const missing = request.trackedRealNames.filter(name => !round.Results.some(player => player.Name === name));
  if (missing.length > 0) throw new Error(`Tracked players not in the round: ${missing.join(", ")}`);
  const fakeNames = buildFakeNames(round.Results.map(player => player.Name));
  return {
    name: request.name,
    description: request.description,
    courseName: round.CourseName,
    date: round.Date,
    tracked: request.trackedRealNames.map(name => fakeNameFor(fakeNames, name)),
    weather: DEFAULT_WEATHER,
    tracks: round.Tracks,
    players: round.Results.map(player => ({ ...player, Name: fakeNameFor(fakeNames, player.Name) })),
    course: request.course,
  };
}

/**
 * Same real first name → same fake first name, so first-name collisions between players survive
 * anonymization; each real surname gets its own fake surname, and the original letter case is kept.
 */
export function buildFakeNames(realNames: readonly string[]): ReadonlyMap<string, string> {
  const firstNames = new Map<string, string>();
  const surnames = new Map<string, string>();
  const fakeNames = new Map<string, string>();
  for (const realName of new Set(realNames)) {
    const [first, ...rest] = realName.trim().split(/\s+/);
    const fakeFirst = assignFake(firstNames, first, FAKE_FIRST_NAMES);
    const surname = rest.join(" ");
    const fakeSurname = surname ? ` ${assignFake(surnames, surname, FAKE_SURNAMES)}` : "";
    fakeNames.set(realName, matchCase(first, fakeFirst) + fakeSurname);
  }
  return fakeNames;
}

function assignFake(assigned: Map<string, string>, real: string, pool: readonly string[]): string {
  const key = real.toLocaleLowerCase("fi");
  const existing = assigned.get(key);
  if (existing) return existing;
  if (assigned.size >= pool.length) throw new Error(`Not enough fake names for ${assigned.size + 1} distinct names`);
  const fake = pool[assigned.size];
  assigned.set(key, fake);
  return fake;
}

function matchCase(original: string, fake: string): string {
  const startsLowercase = original.charAt(0) === original.charAt(0).toLocaleLowerCase("fi");
  return startsLowercase ? fake.toLocaleLowerCase("fi") : fake;
}

function fakeNameFor(fakeNames: ReadonlyMap<string, string>, realName: string): string {
  const fake = fakeNames.get(realName);
  if (!fake) throw new Error(`No fake name for player ${realName}`);
  return fake;
}
