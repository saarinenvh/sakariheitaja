import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DataSource, QueryRunner } from "typeorm";
import { startBotDatabase } from "../botDatabase";
import { wait } from "../../../shared/time";

const CHAT_ID = -5238320046;
const COMPETITION_ID = 1;
const LOCK_WAIT_TIMEOUT_S = 1;
const QUERY_START_TIMEOUT_MS = 5_000;
const PROCESSLIST_POLL_MS = 20;

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let writeRetry: typeof import("../../../db/writeRetry");
let competitions: typeof import("../../../features/live-scoring/db/competitionRepository");

const runners: QueryRunner[] = [];

beforeAll(async () => {
  dataSource = await startBotDatabase("write_retry");
  writeRetry = await import("../../../db/writeRetry");
  competitions = await import("../../../features/live-scoring/db/competitionRepository");

  await dataSource.query("INSERT INTO chats (id, name) VALUES (?, 'Testi')", [CHAT_ID]);
  await competitions.create(CHAT_ID, "3809486");
});

afterEach(async () => {
  for (const runner of runners.splice(0)) await returnToPool(runner);
  await dataSource.query("UPDATE competitions SET status = 'following' WHERE id = ?", [COMPETITION_ID]);
});

afterAll(async () => {
  await dataSource?.destroy();
});

/** A connection of its own, so its session settings and locks don't reach the pool's. */
async function openRunner(): Promise<QueryRunner> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  runners.push(runner);
  return runner;
}

/** Without its lock or its short timeout, which would otherwise go back into the pool with it. A killed one just goes. */
async function returnToPool(runner: QueryRunner): Promise<void> {
  try {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.query("SET SESSION innodb_lock_wait_timeout = DEFAULT");
  } catch {
    // The connection was killed; the pool drops it.
  }

  await runner.release().catch(() => undefined);
}

async function lockCompetition(): Promise<QueryRunner> {
  const holder = await openRunner();
  await holder.startTransaction();
  await holder.query("SELECT id FROM competitions WHERE id = ? FOR UPDATE", [COMPETITION_ID]);
  return holder;
}

/** A connection that gives up on a row lock after a second instead of MariaDB's default 50. */
async function openImpatientRunner(): Promise<QueryRunner> {
  const runner = await openRunner();
  await runner.query(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_S}`);
  return runner;
}

function finishCompetition(runner: QueryRunner): Promise<unknown> {
  return runner.query("UPDATE competitions SET status = 'finished' WHERE id = ?", [COMPETITION_ID]);
}

async function waitUntilRunningQuery(observer: QueryRunner, connectionId: number): Promise<void> {
  const deadline = Date.now() + QUERY_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const [connection] = await observer.query("SELECT COMMAND FROM information_schema.PROCESSLIST WHERE ID = ?", [connectionId]);
    if (connection?.COMMAND === "Query") return;

    await wait(PROCESSLIST_POLL_MS);
  }

  throw new Error(`Connection ${connectionId} never started its query`);
}

async function competitionStatus(): Promise<string> {
  const [{ status }] = await dataSource.query("SELECT status FROM competitions WHERE id = ?", [COMPETITION_ID]);
  return status;
}

describe("transient errors from MariaDB", () => {
  it("recognizes a lock wait timeout", async () => {
    await lockCompetition();
    const waiter = await openImpatientRunner();

    const error = await finishCompetition(waiter).catch((caught: unknown) => caught);

    expect(writeRetry.isTransientDbError(error)).toBe(true);
  });

  it("recognizes a connection the server closed mid-query", async () => {
    const victim = await openRunner();
    const [{ id }] = await victim.query("SELECT CONNECTION_ID() AS id");
    const killer = await openRunner();

    const sleeping = victim.query("SELECT SLEEP(5)").catch((caught: unknown) => caught);
    await waitUntilRunningQuery(killer, Number(id));
    await killer.query(`KILL CONNECTION ${Number(id)}`);

    expect(writeRetry.isTransientDbError(await sleeping)).toBe(true);
  });
});

describe("withWriteRetry", () => {
  it("retries a write through a lock wait timeout once the lock is released", async () => {
    const holder = await lockCompetition();
    const waiter = await openImpatientRunner();
    let attempts = 0;

    await writeRetry.withWriteRetry("finish the competition", async () => {
      attempts++;
      try {
        return await finishCompetition(waiter);
      } finally {
        if (attempts === 1) await holder.rollbackTransaction();
      }
    });

    expect(attempts).toBe(2);
    expect(await competitionStatus()).toBe("finished");
  });
});

describe("the pool", () => {
  // Right after the kill the pool can still hand out a closed connection: that attempt fails with
  // PROTOCOL_CONNECTION_LOST, and the retry gets a new one.
  it("recovers a repository write after the server closes the pool's connections", async () => {
    const killer = await openRunner();
    const poolConnections: { ID: number }[] = await killer.query(
      "SELECT ID FROM information_schema.PROCESSLIST WHERE DB = 'write_retry' AND ID <> CONNECTION_ID()",
    );
    for (const { ID } of poolConnections) await killer.query(`KILL CONNECTION ${ID}`);

    await writeRetry.withWriteRetry("finish the competition", () => competitions.markFinished(COMPETITION_ID));

    expect(await competitionStatus()).toBe("finished");
  });
});
