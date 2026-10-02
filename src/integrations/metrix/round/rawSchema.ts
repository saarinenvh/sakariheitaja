import { z } from "zod";

// Zod schemas for Metrix's `api.php?content=result` payload. They accept Metrix's loose encodings
// and declare only the fields the bot reads; ../README.md lists what each field becomes.

/** Metrix sends numbers as numbers or numeric strings ("3", "-1", "+2"). */
export const integerSchema = z.union([
  z.number().int(),
  z.string().trim().regex(/^[+-]?\d+$/).transform(Number).pipe(z.number().int()),
]);

/** An integer, or null when Metrix sent "", null or nothing. */
export const optionalIntegerSchema = z.union([
  integerSchema,
  z.literal("").transform(() => null),
]).nullish().transform(value => value ?? null);

const positiveInteger = integerSchema.pipe(z.number().int().positive());
const identifier = positiveInteger.transform(String);
const optionalIdentifier = identifier.nullish().catch(null).transform(value => value ?? null);
const optionalText = z.string().nullish().transform(value => value ?? "");

/** Metrix marks DNF as "1", 1, true or "DNF", and a finisher as "0", 0, false, "" or nothing. */
const dnfSchema = z.union([
  z.literal("1"), z.literal(1), z.literal(true), z.literal("DNF"),
  z.literal("0"), z.literal(0), z.literal(false), z.literal(""),
]).nullish().transform(value => value === "1" || value === 1 || value === true || value === "DNF");

/** `PEN` and `OB` both carry the OB count; when both are present they must agree. */
const obScoreFieldsSchema = z.object({
  PEN: optionalIntegerSchema.refine(value => value === null || value >= 0),
  OB: optionalIntegerSchema.refine(value => value === null || value >= 0),
}).refine(score => score.PEN === null || score.OB === null || score.PEN === score.OB);

const holeScoreSchema = z.object({
  Result: positiveInteger,
  Diff: optionalIntegerSchema,
}).and(obScoreFieldsSchema).transform(score => ({
  strokes: score.Result,
  relativeToPar: score.Diff,
  obCount: score.PEN ?? score.OB,
}));

/** `PlayerResults`: one entry per layout hole, `[]` for a hole not recorded yet. */
export const scorecardSchema = z.array(z.union([
  holeScoreSchema,
  z.tuple([]).transform(() => null),
])).nullish();

const trackSchema = z.object({
  Number: positiveInteger,
  NumberAlt: optionalText,
  Par: optionalIntegerSchema.refine(value => value === null || value > 0),
});

const playerSchema = z.object({
  UserID: optionalIntegerSchema.refine(value => value === null || value >= 0),
  Name: z.string().trim().min(1),
  ClassName: optionalText,
  Group: optionalText,
  DNF: dnfSchema,
  Sum: optionalIntegerSchema,
  Diff: optionalIntegerSchema,
  OrderNumber: optionalIntegerSchema.refine(value => value === null || value >= 0),
  PreviousRoundsSum: optionalIntegerSchema,
  PreviousRoundsDiff: optionalIntegerSchema,
  // Parsed separately, so a bad card is reported as "Metrix PlayerResults".
  PlayerResults: z.unknown(),
});

export const roundSchema = z.object({
  Competition: z.object({
    ID: identifier,
    Name: z.string(),
    Date: z.string(),
    CourseName: z.string(),
    CourseID: optionalIdentifier,
    Tracks: z.array(trackSchema),
    SubCompetitions: z.array(z.unknown()).nullish(),
    HasSubcompetitions: optionalIntegerSchema,
    Results: z.array(playerSchema),
    ShowPreviousRoundsSum: optionalIntegerSchema,
  }),
  Errors: z.array(z.string()).nullish().refine(errors => !errors?.length),
});

export type RawPlayer = z.output<typeof playerSchema>;
export type RawCompetition = z.output<typeof roundSchema>["Competition"];
