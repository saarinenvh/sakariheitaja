import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { startBotDatabase } from "../botDatabase";

const MAIN = -1002;
const DEV = -1003;

let dataSource: DataSource;
// Imported after the database is up: the data source reads its settings when first imported.
let greetings: typeof import("../../../features/morning-greeting/db/morningGreetingRepository");

beforeAll(async () => {
  dataSource = await startBotDatabase("morning_greetings");
  greetings = await import("../../../features/morning-greeting/db/morningGreetingRepository");
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe("morning greetings", () => {
  it("gives a chat's last greetings, newest first, without the other chats'", async () => {
    for (const day of ["ma", "ti", "ke", "to", "pe", "la"]) await greetings.save(MAIN, `Huomenta, ${day}!`);
    await greetings.save(DEV, "Testi dev-ryhmässä.");

    expect(await greetings.findRecentTexts(MAIN, 5)).toEqual(["Huomenta, la!", "Huomenta, pe!", "Huomenta, to!", "Huomenta, ke!", "Huomenta, ti!"]);
    expect(await greetings.findRecentTexts(DEV, 5)).toEqual(["Testi dev-ryhmässä."]);
  });

  it("keeps emoji and shouting as written", async () => {
    await greetings.save(DEV, "HYVÄÄ HUOMENTA SANKARIT 🥏🍺");

    expect((await greetings.findRecentTexts(DEV, 1))[0]).toBe("HYVÄÄ HUOMENTA SANKARIT 🥏🍺");
  });
});
