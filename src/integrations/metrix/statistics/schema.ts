import { z } from "zod";
import type { CourseStatistics, HoleResultCounts } from "./courseStatistics";

// Metrix → bot, GET /course/<course id> (the public course page, HTML).
// The page is scraped, not parsed as JSON, so the examples are what parseCourseStatisticsHtml makes
// of its hole-stats table. The same shape is stored in the commentary eval fixtures.

export const holeResultCountsExample = {
  aces: 2,
  eagles: 0,
  birdies: 310,
  pars: 1450,
  bogeys: 520,
  doubleBogeys: 95,
  tripleBogeys: 20,
  worse: 6,
};

export const courseStatisticsExample = {
  holes: [
    { label: "1", par: 3, averageStrokes: 3.12, difficultyRank: 2, counts: holeResultCountsExample },
    { label: "2", par: null, averageStrokes: null, difficultyRank: null, counts: null },
  ],
};

const countSchema = z.number().int().nonnegative();

export const holeResultCountsSchema = z.object({
  aces: countSchema,
  eagles: countSchema,
  birdies: countSchema,
  pars: countSchema,
  bogeys: countSchema,
  doubleBogeys: countSchema,
  tripleBogeys: countSchema,
  worse: countSchema,
}) satisfies z.ZodType<HoleResultCounts>;

export const courseStatisticsSchema = z.object({
  holes: z.array(z.object({
    label: z.string(),
    par: z.number().int().positive().nullable(),
    averageStrokes: z.number().positive().nullable(),
    difficultyRank: z.number().int().positive().nullable(),
    counts: holeResultCountsSchema.nullable(),
  })),
}) satisfies z.ZodType<CourseStatistics>;
