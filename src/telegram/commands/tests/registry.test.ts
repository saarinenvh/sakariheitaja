import { describe, expect, it, vi } from "vitest";

import { Bot } from "grammy";
import { buildCommandGroups, registerCommands } from "../registry";
import { formatHelp } from "../help/help";
import { CommandDependencies } from "../types";

// The commands only hold on to these; nothing here calls a client.
function dependencies(llmEnabled: boolean): CommandDependencies {
  const unused = {} as never;
  return {
    messenger: unused, metrix: unused, openWeather: unused, ollama: unused,
    challonge: unused, giphy: unused, recipes: unused, llmEnabled, gamesChatId: undefined,
  };
}

type Registration = { kind: "command" | "on"; name: string; handler: (ctx: unknown) => Promise<unknown> };

function fakeBot(): { bot: Pick<Bot, "command" | "on">; registrations: Registration[] } {
  const registrations: Registration[] = [];
  const record = (kind: Registration["kind"]) => (name: unknown, handler: unknown) => {
    registrations.push({ kind, name: String(name), handler: handler as Registration["handler"] });
  };
  // grammY's overloaded command/on signatures can't be met by a plain recorder; it only records the arguments.
  return { bot: { command: record("command"), on: record("on") } as unknown as Pick<Bot, "command" | "on">, registrations };
}

const commandNames = (groups: ReturnType<typeof buildCommandGroups>) =>
  groups.flatMap(group => group.commands.map(command => command.name));

describe("command registry", () => {
  it("registers every command before the listeners, with the text listener last", () => {
    const { bot, registrations } = fakeBot();
    registerCommands(bot, dependencies(false));
    const firstListener = registrations.findIndex(registration => registration.kind === "on");
    expect(registrations.slice(0, firstListener).every(registration => registration.kind === "command")).toBe(true);
    expect(registrations.at(-1)).toMatchObject({ kind: "on", name: "message:text" });
  });

  it("registers the dev commands only with the LLM enabled", () => {
    expect(commandNames(buildCommandGroups(dependencies(false)))).not.toContain("heckle");
    expect(commandNames(buildCommandGroups(dependencies(true)))).toEqual(expect.arrayContaining(["heckle", "aamuu"]));
  });

  it("lists every command that has help in /apua, and none of the hidden ones", () => {
    const groups = buildCommandGroups(dependencies(true));
    const help = formatHelp(groups);
    for (const command of groups.flatMap(group => group.commands)) {
      for (const line of command.help ?? []) expect(help).toContain(`${line.usage} - ${line.description}`);
    }
    expect(help).toContain("/tulokset [kentän nimi tai id]");
    for (const command of ["assat", "eaglet", "albatrossit"]) expect(help).toContain(`/${command} [alltime] [kenttä, id tai pelaaja]`);
    expect(help).not.toMatch(/\/(heckle|aamuu|virheet|apua)\b/);
  });

  it("catches a failing command instead of letting it escape", async () => {
    const { bot, registrations } = fakeBot();
    registerCommands(bot, dependencies(false));
    const follow = registrations.find(registration => registration.name === "follow");
    const ctx = { chat: { id: -100 }, match: "", reply: vi.fn().mockRejectedValue(new Error("Telegram down")) };
    await expect(follow?.handler(ctx)).resolves.toBeUndefined();
  });
});
