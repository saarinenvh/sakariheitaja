import { describe, expect, it, vi } from "vitest";

vi.mock("../bot", () => ({ bot: { api: {} } }));
vi.mock("../dependencies", () => ({ trackerDependencies: {}, morningGreetingDependencies: {} }));

import { Bot } from "grammy";
import { activeCommandGroups, registerCommands } from "./registry";
import { formatHelp } from "./help/help";

type Registration = { kind: "command" | "on"; name: string; handler: (ctx: unknown) => Promise<unknown> };

function fakeBot(): { bot: Pick<Bot, "command" | "on">; registrations: Registration[] } {
  const registrations: Registration[] = [];
  const record = (kind: Registration["kind"]) => (name: unknown, handler: unknown) => {
    registrations.push({ kind, name: String(name), handler: handler as Registration["handler"] });
  };
  // grammY's overloaded command/on signatures can't be met by a plain recorder; it only records the arguments.
  return { bot: { command: record("command"), on: record("on") } as unknown as Pick<Bot, "command" | "on">, registrations };
}

const commandNames = (groups: ReturnType<typeof activeCommandGroups>) =>
  groups.flatMap(group => group.commands.map(command => command.name));

describe("command registry", () => {
  it("registers every command before the listeners, with the text listener last", () => {
    const { bot, registrations } = fakeBot();
    registerCommands(bot, false);
    const firstListener = registrations.findIndex(registration => registration.kind === "on");
    expect(registrations.slice(0, firstListener).every(registration => registration.kind === "command")).toBe(true);
    expect(registrations.at(-1)).toMatchObject({ kind: "on", name: "message:text" });
  });

  it("registers the dev commands only with the LLM enabled", () => {
    expect(commandNames(activeCommandGroups(false))).not.toContain("heckle");
    expect(commandNames(activeCommandGroups(true))).toEqual(expect.arrayContaining(["heckle", "aamuu"]));
  });

  it("lists every command that has help in /apua, and none of the hidden ones", () => {
    const groups = activeCommandGroups(true);
    const help = formatHelp(groups);
    for (const command of groups.flatMap(group => group.commands)) {
      for (const line of command.help ?? []) expect(help).toContain(`${line.usage} - ${line.description}`);
    }
    expect(help).toContain("/tulokset [kentän nimi tai id]");
    expect(help).not.toMatch(/\/(isit|heckle|aamuu|apua)\b/);
  });

  it("catches a failing command instead of letting it escape", async () => {
    const { bot, registrations } = fakeBot();
    registerCommands(bot, false);
    const follow = registrations.find(registration => registration.name === "follow");
    const ctx = { chat: { id: -100 }, match: "", reply: vi.fn().mockRejectedValue(new Error("Telegram down")) };
    await expect(follow?.handler(ctx)).resolves.toBeUndefined();
  });
});
