import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GamePlan, MakePlanResult } from "../../../../features/games";

const mocks = vi.hoisted(() => ({
  makePlan: vi.fn(), listPlans: vi.fn(), joinPlan: vi.fn(), leavePlan: vi.fn(), cancelPlan: vi.fn(),
  replaceBotPin: vi.fn(), editBotPin: vi.fn(), removeBotPin: vi.fn(),
}));
vi.mock("../../../botPin", () => ({ replaceBotPin: mocks.replaceBotPin, editBotPin: mocks.editBotPin, removeBotPin: mocks.removeBotPin }));
// The real summary format, so the replies are checked as they're sent.
vi.mock("../../../../features/games", async () => ({
  ...mocks, formatPlanSummary: (await import("../../../../features/games/planSummary")).formatPlanSummary,
}));

import { CommandContext, Context } from "grammy";
import { cancelGamePlan, joinGamePlan, leaveGamePlan, listGamePlans, makeGamePlan } from "../planning";
import { planningMessages as MSG } from "../messages";

const CHAT_ID = -100;
const VILLE = { id: 42, first_name: "Ville" };

/** `from: null` is a message without a sender, like a channel post. */
function command(match: string, from: { id: number; first_name: string } | null = VILLE) {
  let nextMessageId = 500;
  const reply = vi.fn(async (text: string) => ({ message_id: nextMessageId++, text }));
  const api = {};
  // Only the fields the handlers read.
  const ctx = { match, chat: { id: CHAT_ID, title: "SakariPelit" }, from: from ?? undefined, reply, api } as unknown as CommandContext<Context>;

  return { ctx, reply, api };
}

/** A plan as the feature returns it; only the fields the formatting reads. */
function plan(fields: Partial<GamePlan> & { playerNames?: string[] }): GamePlan {
  const { playerNames = [], ...rest } = fields;

  return {
    id: 12, day: "2026-10-10", startTime: "09:00:00", courses: ["Karjaa", "Härkälinna"],
    players: playerNames.map(name => ({ name })), ...rest,
  } as GamePlan;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/hep", () => {
  it("asks for the plan without text", async () => {
    const { ctx, reply } = command("");

    await makeGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.hepUsage);
    expect(mocks.makePlan).not.toHaveBeenCalled();
  });

  it("saves nothing without a sender", async () => {
    const { ctx, reply } = command("la 18 Keljo", null);

    await makeGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.noSender);
    expect(mocks.makePlan).not.toHaveBeenCalled();
  });

  it("makes the plan in this chat as the sender, and confirms it with its number and the whole list", async () => {
    const saved = plan({ startTime: "18:00:00", courses: ["Keljo"], playerNames: ["Ville"] });
    mocks.makePlan.mockResolvedValue({ kind: "saved", plan: saved });
    mocks.listPlans.mockResolvedValue([saved, plan({ id: 13, day: "2026-10-11", startTime: null, courses: ["Tali"] })]);
    const { ctx, reply } = command("la 18 Keljo");

    await makeGamePlan(ctx);

    expect(mocks.makePlan).toHaveBeenCalledWith({ id: CHAT_ID, name: "SakariPelit" }, { telegramUserId: 42, name: "Ville" }, "la 18 Keljo");
    expect(reply.mock.calls).toEqual([[
      `${MSG.hepSaved(12, "la 10.10. klo 18.00 Keljo — Ville")}\n\n${MSG.hepitHeader}\n\n`
      + `12. la 10.10. klo 18.00 Keljo — Ville\n13. su 11.10. Tali\n\n${MSG.hepitFooter}`,
    ]]);
  });

  it("pins the list it sent in place of the bot's previous pin", async () => {
    mocks.makePlan.mockResolvedValue({ kind: "saved", plan: plan({}) });
    mocks.listPlans.mockResolvedValue([plan({})]);
    const { ctx, api } = command("la 9 Karjaa + Härkälinna");

    await makeGamePlan(ctx);

    expect(mocks.replaceBotPin).toHaveBeenCalledWith(api, CHAT_ID, 500);
  });

  it("pins the first part of a list too long for one message", async () => {
    const longCourse = "Keljo ".repeat(100).trim();
    mocks.makePlan.mockResolvedValue({ kind: "saved", plan: plan({}) });
    mocks.listPlans.mockResolvedValue(Array.from({ length: 12 }, (_, index) => plan({ id: index + 1, courses: [longCourse] })));
    const { ctx, reply } = command("la 9 Keljo");

    await makeGamePlan(ctx);

    expect(reply.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.replaceBotPin).toHaveBeenCalledWith(expect.anything(), CHAT_ID, 500);
  });

  it.each<[MakePlanResult, string]>([
    [{ kind: "free-text" }, MSG.hepFreeText],
    [{ kind: "no-courses" }, MSG.hepNoCourses],
    [{ kind: "past" }, MSG.hepPast],
    [{ kind: "too-far", maxDaysAhead: 60 }, MSG.hepTooFar(60)],
  ])("answers %o", async (result, expected) => {
    mocks.makePlan.mockResolvedValue(result);
    const { ctx, reply } = command("whatever");

    await makeGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(expected);
    expect(mocks.replaceBotPin).not.toHaveBeenCalled();
  });
});

describe("the pinned list after a change", () => {
  it.each<[string, () => void, (ctx: CommandContext<Context>) => Promise<unknown>]>([
    ["/mukaan", () => mocks.joinPlan.mockResolvedValue({ kind: "joined" }), joinGamePlan],
    ["/pois", () => mocks.leavePlan.mockResolvedValue({ kind: "left" }), leaveGamePlan],
    ["/peru", () => mocks.cancelPlan.mockResolvedValue({ kind: "cancelled" }), cancelGamePlan],
  ])("%s edits it to the current list, after the reply", async (_name, succeed, handle) => {
    succeed();
    mocks.listPlans.mockResolvedValue([plan({ playerNames: ["Ville", "Wiltzu"] })]);
    const { ctx, reply, api } = command("12");

    await handle(ctx);

    expect(mocks.editBotPin).toHaveBeenCalledWith(
      api, CHAT_ID, `${MSG.hepitHeader}\n\n12. la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Wiltzu\n\n${MSG.hepitFooter}`,
    );
    expect(reply.mock.invocationCallOrder[0]).toBeLessThan(mocks.editBotPin.mock.invocationCallOrder[0]);
  });

  it("is unpinned when the last plan is cancelled", async () => {
    mocks.cancelPlan.mockResolvedValue({ kind: "cancelled" });
    mocks.listPlans.mockResolvedValue([]);
    const { ctx, api } = command("12");

    await cancelGamePlan(ctx);

    expect(mocks.removeBotPin).toHaveBeenCalledWith(api, CHAT_ID);
    expect(mocks.editBotPin).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, (ctx: CommandContext<Context>) => Promise<unknown>]>([
    ["/mukaan", () => mocks.joinPlan.mockResolvedValue({ kind: "already" }), joinGamePlan],
    ["/pois", () => mocks.leavePlan.mockResolvedValue({ kind: "not-in-plan" }), leaveGamePlan],
    ["/peru", () => mocks.cancelPlan.mockResolvedValue({ kind: "not-creator" }), cancelGamePlan],
  ])("%s leaves it alone when nothing changed", async (_name, refuse, handle) => {
    refuse();
    const { ctx } = command("12");

    await handle(ctx);

    expect(mocks.listPlans).not.toHaveBeenCalled();
    expect(mocks.editBotPin).not.toHaveBeenCalled();
    expect(mocks.removeBotPin).not.toHaveBeenCalled();
  });
});

describe("/hepit", () => {
  it("lists the plans with their numbers", async () => {
    mocks.listPlans.mockResolvedValue([plan({ playerNames: ["Ville"] }), plan({ id: 13, day: "2026-10-11", startTime: null, courses: ["Tali"] })]);
    const { ctx, reply } = command("");

    await listGamePlans(ctx);

    expect(mocks.listPlans).toHaveBeenCalledWith(CHAT_ID);
    expect(reply).toHaveBeenCalledWith(
      `${MSG.hepitHeader}\n\n12. la 10.10. klo 9.00 Karjaa + Härkälinna — Ville\n13. su 11.10. Tali\n\n${MSG.hepitFooter}`,
    );
  });

  it("splits a long list into replies that each fit Telegram's limit, never splitting a plan", async () => {
    const longCourse = "Keljo ".repeat(100).trim();
    mocks.listPlans.mockResolvedValue(Array.from({ length: 12 }, (_, index) => plan({ id: index + 1, courses: [longCourse] })));
    const { ctx, reply } = command("");

    await listGamePlans(ctx);

    const replies: string[] = reply.mock.calls.map(call => call[0]);
    expect(replies.length).toBeGreaterThan(1);
    expect(replies.every(text => text.length <= 4096)).toBe(true);
    expect(replies.join("\n").match(/^\d+\. /gm)).toHaveLength(12);
    expect(replies.at(-1)?.endsWith(MSG.hepitFooter)).toBe(true);
  });

  it("says so when there are none", async () => {
    mocks.listPlans.mockResolvedValue([]);
    const { ctx, reply } = command("");

    await listGamePlans(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.hepitNone);
  });
});

describe("/mukaan", () => {
  it.each(["", "x", "0", "-3"])("asks for a plan number for %j", async match => {
    const { ctx, reply } = command(match);

    await joinGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.planNumberUsage("mukaan"));
    expect(mocks.joinPlan).not.toHaveBeenCalled();
  });

  it("adds the sender with their Telegram id", async () => {
    mocks.joinPlan.mockResolvedValue({ kind: "joined" });
    const { ctx, reply } = command("12");

    await joinGamePlan(ctx);

    expect(mocks.joinPlan).toHaveBeenCalledWith(CHAT_ID, 12, { name: "Ville", telegramUserId: 42 });
    expect(reply).toHaveBeenCalledWith(MSG.joined("Ville", 12));
  });

  it("adds a named player, spaces and all, without an id", async () => {
    mocks.joinPlan.mockResolvedValue({ kind: "joined" });
    const { ctx } = command("12 Wiltzu Virtanen");

    await joinGamePlan(ctx);

    expect(mocks.joinPlan).toHaveBeenCalledWith(CHAT_ID, 12, { name: "Wiltzu Virtanen", telegramUserId: null });
  });

  it.each([
    [{ kind: "already" }, MSG.alreadyIn("Ville")],
    [{ kind: "no-plan" }, MSG.noPlan],
    [{ kind: "name-too-long", maxLength: 100 }, MSG.nameTooLong(100)],
  ])("answers %o", async (result, expected) => {
    mocks.joinPlan.mockResolvedValue(result);
    const { ctx, reply } = command("12");

    await joinGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(expected);
  });
});

describe("/pois", () => {
  it("removes the sender by their Telegram id", async () => {
    mocks.leavePlan.mockResolvedValue({ kind: "left" });
    const { ctx, reply } = command("12");

    await leaveGamePlan(ctx);

    expect(mocks.leavePlan).toHaveBeenCalledWith(CHAT_ID, 12, { kind: "member", telegramUserId: 42 });
    expect(reply).toHaveBeenCalledWith(MSG.left("Ville", 12));
  });

  it("removes a named player by name", async () => {
    mocks.leavePlan.mockResolvedValue({ kind: "not-in-plan" });
    const { ctx, reply } = command("12 Wiltzu");

    await leaveGamePlan(ctx);

    expect(mocks.leavePlan).toHaveBeenCalledWith(CHAT_ID, 12, { kind: "name", name: "Wiltzu" });
    expect(reply).toHaveBeenCalledWith(MSG.notInPlan("Wiltzu"));
  });

  it("can't remove the sender without one", async () => {
    const { ctx, reply } = command("12", null);

    await leaveGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.noSender);
  });
});

describe("/peru", () => {
  it("cancels as the sender", async () => {
    mocks.cancelPlan.mockResolvedValue({ kind: "cancelled" });
    const { ctx, reply } = command("12");

    await cancelGamePlan(ctx);

    expect(mocks.cancelPlan).toHaveBeenCalledWith(CHAT_ID, 12, 42);
    expect(reply).toHaveBeenCalledWith(MSG.cancelled(12));
  });

  it("refuses someone else's plan", async () => {
    mocks.cancelPlan.mockResolvedValue({ kind: "not-creator" });
    const { ctx, reply } = command("12");

    await cancelGamePlan(ctx);

    expect(reply).toHaveBeenCalledWith(MSG.notCreator);
  });
});
