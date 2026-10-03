import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dotenvConfig: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: mocks.dotenvConfig }, config: mocks.dotenvConfig }));

import { createBot } from "../bot";

it("creates the bot without loading an environment file; config.ts loads ENV_FILE once", () => {
  expect(createBot("123:abc").token).toBe("123:abc");
  expect(mocks.dotenvConfig).not.toHaveBeenCalled();
});
