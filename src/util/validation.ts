import { z } from "zod";

export class ValidationError extends Error {
  constructor(source: string, issues: z.ZodError) {
    super(`Invalid ${source}`, { cause: issues });
    this.name = "ValidationError";
  }
}

export function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  source: string,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(source, result.error);
  return result.data;
}
