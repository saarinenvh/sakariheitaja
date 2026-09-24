import { join } from "path";
import { createJsonStore } from "../../shared/jsonStore";
import { MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";
import Logger from "js-logger";

const PROFILES_PATH = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, "player_profiles.json")
  : join(__dirname, "../../bot/system-prompts/player_profiles.json");

export interface PlayerProfile {
  nickname?: string;
  knownFor?: string;
  recentForm: "hot" | "cold" | "steady";
  gamesPlayed: number;
  avgPositionPct: number;
  lastUpdated: string;
}

type ProfileStore = Record<string, Record<string, PlayerProfile>>;

const profileStore = createJsonStore<ProfileStore>(PROFILES_PATH, () => ({}));

function load(): ProfileStore {
  return profileStore.load();
}

function save(store: ProfileStore): void {
  profileStore.save(store);
}

export function getProfile(chatId: number, name: string): PlayerProfile | undefined {
  return load()[String(chatId)]?.[name];
}

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

// Takes the full result set rather than a single field size: OrderNumber is a
// position WITHIN a division, so dividing it by the whole competition's head
// count (what the caller used to pass) made every player in a small division
// look like a front-runner - 3rd of 10 in MA3 at a 50-player event scored 0.06,
// i.e. "tyypillisesti kärjessä". That rating is fed straight back into
// commentary via buildProfileSnippet, so it isn't only a stats problem.
export function updateProfiles(chatId: number, trackedPlayers: TrackedPlayer[], allResults: MetrixPlayerResult[]): void {
  if (allResults.length === 0) return;

  const divisionFieldSize = new Map<string, number>();
  for (const r of allResults) {
    divisionFieldSize.set(r.ClassName, (divisionFieldSize.get(r.ClassName) ?? 0) + 1);
  }

  const store = load();
  const chatKey = String(chatId);
  if (!store[chatKey]) store[chatKey] = {};

  const today = new Date().toISOString().slice(0, 10);

  for (const player of trackedPlayers) {
    const existing = store[chatKey][player.Name];
    const fieldSize = divisionFieldSize.get(player.ClassName) ?? allResults.length;
    if (fieldSize === 0) continue;
    const positionPct = player.OrderNumber / fieldSize;

    const prevGames = existing?.gamesPlayed ?? 0;
    const prevAvgPct = existing?.avgPositionPct ?? positionPct;
    const newAvgPct = (prevAvgPct * prevGames + positionPct) / (prevGames + 1);

    const recentForm: PlayerProfile["recentForm"] =
      positionPct < prevAvgPct - 0.15 ? "hot" :
      positionPct > prevAvgPct + 0.15 ? "cold" :
      "steady";

    store[chatKey][player.Name] = {
      ...(existing ?? {}),
      recentForm,
      gamesPlayed: prevGames + 1,
      avgPositionPct: Math.round(newAvgPct * 1000) / 1000,
      lastUpdated: today,
    };
  }

  save(store);
  Logger.info(`Updated player profiles for ${trackedPlayers.length} players (chat ${chatId})`);
}
