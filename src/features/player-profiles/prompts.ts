import { getProfile } from "./playerProfiles";

/** A player's profile as a Finnish phrase for the model; unused until profiles reach commentary (EfY0S63X). */
export function buildProfileSnippet(chatId: number, name: string): string | undefined {
  const profile = getProfile(chatId, name);
  if (!profile) return undefined;

  const parts: string[] = [];

  if (profile.nickname) parts.push(`lempinimeltään ${profile.nickname}`);
  if (profile.knownFor) parts.push(profile.knownFor);

  if (profile.gamesPlayed >= 3) {
    const pct = profile.avgPositionPct;
    if (pct < 0.25)      parts.push("tyypillisesti kärjessä");
    else if (pct < 0.60) parts.push("tavallisesti keskikastissa");
    else                 parts.push("usein häntäpäässä");
  }

  if (profile.recentForm === "hot")  parts.push("viime aikoina hyvässä vireessä");
  if (profile.recentForm === "cold") parts.push("viime aikoina surkea vire");

  if (parts.length === 0) return undefined;
  return parts.join(", ");
}
