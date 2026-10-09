import { GamePlan, formatPlanSummary, listPlans, PLAN_TIME_ZONE } from "../../../features/games";
import { listChatsWithBotPin } from "../../../features/chats";
import { moduleLogger } from "../../../shared/logger";
import { packLines } from "../../../shared/telegramText";
import { addDays, dayInTimeZone, zonedTimeToInstant } from "../../../shared/time";
import { editBotPin, PinApi, removeBotPin } from "../../botPin";
import { planningMessages as MSG } from "./messages";

// The plans list the bot pins with /hep, kept current: after every change to the plans, and once a
// day just after midnight, when yesterday's games drop out. The plans list is the bot pin's only
// use so far, so every bot pin is refreshed as one.

const log = moduleLogger("pinned-list");

/** Helsinki wall-clock time of the daily refresh: just after the day changes. */
const DAILY_REFRESH_TIME = "00:01";

/** Refreshes every pin now, then every day just after midnight. */
export function startPinnedListRefresher(api: PinApi): void {
  void refreshAllPinnedLists(api);
  scheduleNextRefresh(api);
}

/**
 * Brings the chat's pinned list up to date, quietly, by editing it; with no plans left, unpins it.
 * A list longer than one message keeps its first part pinned.
 */
export async function refreshPinnedList(api: PinApi, chatId: number): Promise<void> {
  const plans = await listPlans(chatId);
  if (plans.length === 0) return removeBotPin(api, chatId);

  const [firstPart] = packLines(formatPlanList(plans));

  await editBotPin(api, chatId, firstPart);
}

/** The `/hepit` list: a header, a line per plan with its number, and how to join. */
export function formatPlanList(plans: readonly GamePlan[]): string[] {
  const planLines = plans.map(plan => `${plan.id}. ${formatPlanSummary(plan)}`);

  return [MSG.hepitHeader, "", ...planLines, "", MSG.hepitFooter];
}

/** How long until the next daily refresh: tomorrow's 00:01 in Helsinki, with that day's DST. */
export function msUntilNextRefresh(now: Date): number {
  const tomorrow = addDays(dayInTimeZone(now, PLAN_TIME_ZONE), 1);

  return zonedTimeToInstant(tomorrow, DAILY_REFRESH_TIME, PLAN_TIME_ZONE).getTime() - now.getTime();
}

/** Refreshes each chat's pin on its own, so one failing chat doesn't stop the rest. Never throws. */
export async function refreshAllPinnedLists(api: PinApi): Promise<void> {
  let chatIds: number[];
  try {
    chatIds = await listChatsWithBotPin();
  } catch (error) {
    log.error({ err: error }, "could not list the chats with a pinned list");
    return;
  }

  for (const chatId of chatIds) {
    try {
      await refreshPinnedList(api, chatId);
    } catch (error) {
      log.error({ err: error, chatId }, "could not refresh the pinned list");
    }
  }
}

function scheduleNextRefresh(api: PinApi): void {
  const delayMs = msUntilNextRefresh(new Date());
  log.info({ delayMs }, "next pinned list refresh scheduled");

  setTimeout(async () => {
    await refreshAllPinnedLists(api);
    scheduleNextRefresh(api);
  }, delayMs);
}
