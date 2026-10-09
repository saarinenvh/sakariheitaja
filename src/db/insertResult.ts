import type { InsertResult } from "typeorm";

/**
 * True when an `insert().orIgnore()` added a row: MariaDB reports it in `affectedRows`. Deciding from
 * an earlier existence check instead would let two concurrent inserts both report adding the row.
 */
export function insertedRow(result: InsertResult): boolean {
  return insertedRowCount(result) > 0;
}

/** How many rows an `insert().orIgnore()` added, from MariaDB's `affectedRows`. */
export function insertedRowCount(result: InsertResult): number {
  const raw: unknown = result.raw;
  const affectedRows = typeof raw === "object" && raw !== null && "affectedRows" in raw ? raw.affectedRows : 0;

  return typeof affectedRows === "number" ? affectedRows : 0;
}
