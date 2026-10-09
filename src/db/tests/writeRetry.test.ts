import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { isTransientDbError, withWriteRetry } from "../writeRetry";

function driverError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function queryError(code: string): QueryFailedError {
  return new QueryFailedError("UPDATE competitions SET status = ?", ["finished"], driverError(code));
}

describe("withWriteRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries a transient error until the write succeeds", async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(queryError("ER_LOCK_DEADLOCK"))
      .mockRejectedValueOnce(driverError("PROTOCOL_CONNECTION_LOST"))
      .mockResolvedValue("saved");

    const result = withWriteRetry("save results", write);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("throws any other error at once", async () => {
    const duplicate = queryError("ER_DUP_ENTRY");
    const write = vi.fn().mockRejectedValue(duplicate);

    await expect(withWriteRetry("save results", write)).rejects.toBe(duplicate);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("gives up after five attempts, with the last error", async () => {
    const lost = driverError("ECONNREFUSED");
    const write = vi.fn().mockRejectedValue(lost);

    const result = withWriteRetry("save results", write);
    const settled = expect(result).rejects.toBe(lost);
    await vi.runAllTimersAsync();

    await settled;
    expect(write).toHaveBeenCalledTimes(5);
  });

  it("waits longer before each retry", async () => {
    const write = vi.fn().mockRejectedValue(queryError("ER_LOCK_WAIT_TIMEOUT"));

    const result = withWriteRetry("save results", write).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(write).toHaveBeenCalledTimes(3);

    await vi.runAllTimersAsync();
    await result;
  });
});

describe("isTransientDbError", () => {
  it("is true for lock and connection failures, from TypeORM or the driver", () => {
    expect(isTransientDbError(queryError("ER_LOCK_DEADLOCK"))).toBe(true);
    expect(isTransientDbError(queryError("ER_LOCK_WAIT_TIMEOUT"))).toBe(true);
    expect(isTransientDbError(driverError("ECONNRESET"))).toBe(true);
  });

  it("is false for errors a retry can't fix", () => {
    expect(isTransientDbError(queryError("ER_DUP_ENTRY"))).toBe(false);
    expect(isTransientDbError(queryError("ER_DATA_TOO_LONG"))).toBe(false);
    expect(isTransientDbError(new Error("Course could not be created"))).toBe(false);
    expect(isTransientDbError("ER_LOCK_DEADLOCK")).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});
