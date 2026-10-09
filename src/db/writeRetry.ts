import { moduleLogger } from "../shared/logger";
import { wait } from "../shared/time";

const log = moduleLogger("write-retry");

/** The waits between attempts: about 15 s in all, enough to ride out a MariaDB restart. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;

/** mysql2 error codes for failures that pass on their own: a lock that clears, a connection that comes back. */
const TRANSIENT_ERROR_CODES: ReadonlySet<string> = new Set([
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
  "ER_CON_COUNT_ERROR",
  "PROTOCOL_CONNECTION_LOST",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
]);

/**
 * Runs a background write, again while it fails on a transient database error; any other error is
 * thrown at once. The write must be safe to repeat, since a failed attempt may still have committed:
 * pass the whole operation or transaction, not one statement of it.
 */
export async function withWriteRetry<T>(operation: string, write: () => Promise<T>): Promise<T> {
  for (const delayMs of RETRY_DELAYS_MS) {
    try {
      return await write();
    } catch (error) {
      if (!isTransientDbError(error)) throw error;

      log.warn({ operation, delayMs, err: error }, "transient database error, retrying");
      await wait(delayMs);
    }
  }

  return write();
}

/** TypeORM's `QueryFailedError` carries the driver error's `code`, as do the driver's connection errors. */
export function isTransientDbError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;

  return typeof error.code === "string" && TRANSIENT_ERROR_CODES.has(error.code);
}
