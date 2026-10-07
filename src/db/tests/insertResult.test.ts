import { describe, expect, it } from "vitest";
import { InsertResult } from "typeorm";
import { insertedRow } from "../insertResult";

function resultWithRaw(raw: unknown): InsertResult {
  const result = new InsertResult();
  result.raw = raw;
  return result;
}

describe("insertedRow", () => {
  it("is true only when MariaDB reports an added row", () => {
    expect(insertedRow(resultWithRaw({ affectedRows: 1 }))).toBe(true);
    expect(insertedRow(resultWithRaw({ affectedRows: 0 }))).toBe(false);
  });

  it("is false for a result without affectedRows", () => {
    expect(insertedRow(resultWithRaw(undefined))).toBe(false);
    expect(insertedRow(resultWithRaw([]))).toBe(false);
  });
});
