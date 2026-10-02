import { z } from "zod";

export const integerSchema = z.union([
  z.number().int(),
  z.string().trim().regex(/^[+-]?\d+$/).transform(Number).pipe(z.number().int()),
]);

export const optionalIntegerSchema = z.union([
  integerSchema,
  z.literal("").transform(() => null),
]).nullish().transform(value => value ?? null);
