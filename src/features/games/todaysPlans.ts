// Who is playing today (/hep, /pelei): one plan per user, in memory, cleared when the date changes.

let plans: Record<string, string> = {};
let plansDate = new Date().toLocaleDateString();

export function announcePlan(user: string, plan: string): void {
  expireIfNewDay();
  plans[user] = plan;
}

/** Today's plans by user; empty on a new day. */
export function todaysPlans(): Readonly<Record<string, string>> {
  expireIfNewDay();
  return plans;
}

function expireIfNewDay(): void {
  const today = new Date().toLocaleDateString();
  if (today !== plansDate) {
    plans = {};
    plansDate = today;
  }
}
