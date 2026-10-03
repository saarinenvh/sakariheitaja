import { z } from "zod";

// Metrix → bot, GET api.php?content=result&id=<round id> (JSON).
// The schemas accept Metrix's loose encodings; ../README.md lists what each field becomes.

export const scorecardExample = [
  { Result: "3", Diff: 0, PEN: "0", BUE: "0", GRH: "0", OCP: "0", ICP: "0", IBP: "0" }, // ignored: BUE, GRH, OCP, ICP, IBP
  { Result: "5", Diff: 1, PEN: "1", BUE: "0", GRH: "0", OCP: "0", ICP: "0", IBP: "0" },
  [], // not recorded yet
];

export const roundExample = {
  Competition: {
    ID: 1234567,
    Name: "Example Weekly &rarr; Round 1",
    Type: "2", // ignored
    TourDateStart: null, // ignored
    TourDateEnd: null, // ignored
    Date: "2026-10-03",
    Time: "18:00:00", // ignored
    Comment: "", // ignored
    CourseName: "Example Park &rarr; Main Layout",
    CourseID: "12345",
    MetrixMode: "1", // ignored
    ShowPreviousRoundsSum: null,
    HasSubcompetitions: 0,
    // SubCompetitions: only sent for an event or series, which the bot rejects.
    WeeklyHCSummary: null, // ignored
    WeeklyHC: [], // ignored
    Results: [
      {
        UserID: "100001",
        ScorecardID: "2000001", // ignored
        Name: "Player One",
        ClassName: "MA3",
        CountryCode: "FI", // ignored
        Group: "1",
        PlayerResults: scorecardExample,
        Penalty: null, // ignored
        Sum: 8,
        Diff: 1,
        DNF: null,
        BUETotal: "", // ignored
        GRHTotal: "", // ignored
        OCPTotal: "", // ignored
        ICPTotal: "", // ignored
        IBPTotal: "", // ignored
        PenaltiesTotal: "", // ignored
        PreviousRoundsSum: null,
        PreviousRoundsDiff: null,
        Place: 1, // ignored: the place comes from OrderNumber
        OrderNumber: 1,
      },
    ],
    Tracks: [
      { Number: "1", NumberAlt: "", Par: "3" },
      { Number: "2", NumberAlt: "", Par: "4" },
      { Number: "3", NumberAlt: "3A", Par: "3" },
    ],
  },
  Errors: [],
};

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
