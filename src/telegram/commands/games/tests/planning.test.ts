import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GamePlan, MakePlanResult } from "../../../../features/games";

const mocks = vi.hoisted(() => ({
  makePlan: vi.fn(), listPlans: vi.fn(), joinPlan: vi.fn(), leavePlan: vi.fn(), cancelPlan: vi.fn(),
}));
vi.mock("../../../../features/games", () => mocks);

import { CommandContext, Context } from "grammy";
import { cancelGamePlan, formatPlanSummary, joinGamePlan, leaveGamePlan, listGamePlans, makeGamePlan } from "../planning";
import { planningMessages as MSG } from "../messages";

const CHAT_ID = -100;
const VILLE = { id: 42, first_name: "Ville" };

/** `from: null` is a message without a sender, like a channel post. */
function command(match: string, from: { id: number; first_name: string } | null = VILLE) {
  const reply = vi.fn().mockResolvedValue(undefined);
  // Only the fields the handlers read.
  const ctx = { match, chat: { id: CHAT_ID, title: "SakariPelit" }, from: from ?? undefined, reply } as unknown as CommandContext<Context>;

  return { ctx, reply };
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

describe("the plan summary", () => {
  it("shows the day, time, courses and players", () => {
    expect(formatPlanSummary(plan({ playerNames: ["Ville", "Wiltzu"] })))
      .toBe("la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Wiltzu");
  });

  it("leaves out a time and players it doesn't have", () => {
    expect(formatPlanSummary(plan({ startTime: null, courses: ["Tali"] }))).toBe("la 10.10. Tali");
  });
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

  it("makes the plan in this chat as the sender, and confirms it with its number", async () => {
    mocks.makePlan.mockResolvedValue({ kind: "saved", plan: plan({ startTime: "18:00:00", courses: ["Keljo"], playerNames: ["Ville"] }) });
    const { ctx, reply } = command("la 18 Keljo");

    await makeGamePlan(ctx);

    expect(mocks.makePlan).toHaveBeenCalledWith({ id: CHAT_ID, name: "SakariPelit" }, { telegramUserId: 42, name: "Ville" }, "la 18 Keljo");
    expect(reply).toHaveBeenCalledWith(MSG.hepSaved(12, "la 10.10. klo 18.00 Keljo — Ville"));
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
