import { z } from "zod";

// Model → bot: the game plan reader's answer, Ollama structured output (JSON).

/** "pekan ja matin kanssa karjaa + härkälinna lauantaina. Lähtö 9.00.", written on Thursday 8.10.2026. */
export const planReadingExample = {
  isPlan: true,
  day: "2026-10-10",
  time: "09:00",
  courses: ["Karjaa", "Härkälinna"],
  players: ["Pekka", "Matti"],
  creatorPlays: true,
};

const nonEmptyText = z.string().trim().min(1);

export const planReadingSchema = z.object({
  isPlan: z.boolean(),
  /** `YYYY-MM-DD`; null when the text names no day. */
  day: z.iso.date().nullable(),
  /** `HH:MM`; null when the text names no time. */
  time: z.iso.time({ precision: -1 }).nullable(),
  courses: z.array(nonEmptyText),
  /** The players the text names, in base form; the writer only through `creatorPlays`. */
  players: z.array(nonEmptyText),
  /** Whether the writer plays too ("pekan kanssa", "pelataan"), or arranges a game for others. */
  creatorPlays: z.boolean(),
});

export type PlanReading = z.output<typeof planReadingSchema>;

/** The same shape as Ollama's `format`, so the model answers in it. */
export const planReadingJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    isPlan: { type: "boolean" },
    day: { type: ["string", "null"], description: "YYYY-MM-DD" },
    time: { type: ["string", "null"], description: "HH:MM" },
    courses: { type: "array", items: { type: "string" } },
    players: { type: "array", items: { type: "string" } },
    creatorPlays: { type: "boolean" },
  },
  required: ["isPlan", "day", "time", "courses", "players", "creatorPlays"],
};
