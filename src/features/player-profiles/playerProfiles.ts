import { join } from "path";
import { createJsonStore } from "../../shared/jsonStore";
import { readConfig } from "../../config";
import { RankedResult } from "../../integrations/metrix/round/results";
import { moduleLogger } from "../../shared/logger";
import { profileAfterRound } from "./policy";

const log = moduleLogger("player-profiles");

const DATA_DIR = readConfig().dataDir;
const PROFILES_PATH = DATA_DIR
  ? join(DATA_DIR, "player_profiles.json")
  : join(__dirname, "../../data/player_profiles.json");

export interface PlayerProfile {
  nickname?: string;
  knownFor?: string;
  recentForm: "hot" | "cold" | "steady";
  gamesPlayed: number;
  avgPositionPct: number;
  lastUpdated: string;
  /** The competition last counted; a retried round end doesn't count it again. */
  lastCompetitionId?: number;
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

// A position is within a division, so it is scored against that division's field, not the whole event's.
export function updateProfiles(
  chatId: number, competitionId: number, trackedPlayers: readonly RankedResult[], allResults: readonly RankedResult[],
): void {
  if (allResults.length === 0) return;

  const divisionFieldSize = new Map<string, number>();
  for (const r of allResults) {
    divisionFieldSize.set(r.division, (divisionFieldSize.get(r.division) ?? 0) + 1);
  }

  const store = load();
  const chatKey = String(chatId);
  if (!store[chatKey]) store[chatKey] = {};

  const today = new Date().toISOString().slice(0, 10);

  for (const player of trackedPlayers) {
    const existing = store[chatKey][player.playerName];
    if (existing?.lastCompetitionId === competitionId) continue;
    const fieldSize = divisionFieldSize.get(player.division) ?? allResults.length;
    if (fieldSize === 0) continue;
    const positionPct = player.position / fieldSize;

    store[chatKey][player.playerName] = profileAfterRound(existing, { positionPct, competitionId, date: today });
  }

  save(store);
  log.info({ chatId, players: trackedPlayers.length }, "player profiles updated");
}
