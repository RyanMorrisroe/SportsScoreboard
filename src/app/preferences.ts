import { LEAGUE_IDS } from "./leagues";
import type { LeagueId } from "../plugins/registry";

const PREFERENCES_KEY = "sports-scoreboard.preferences";
const PREFERENCES_VERSION = 1;

export interface FavoriteTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
}

export interface Preferences {
  version: typeof PREFERENCES_VERSION;
  autoCheckForUpdates: boolean;
  visibleLeagues: LeagueId[];
  leagueOrder: LeagueId[];
  favoriteTeams: Record<LeagueId, FavoriteTeam[]>;
}

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLeagueId(value: unknown): value is LeagueId {
  return typeof value === "string" && LEAGUE_IDS.includes(value as LeagueId);
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeTeam(value: unknown): FavoriteTeam | null {
  if (!isObject(value) || value.id === undefined || value.id === null) return null;

  const id = String(value.id).trim();
  if (!id) return null;
  return {
    id,
    name: typeof value.name === "string" && value.name.trim() ? value.name : id,
    abbreviation: typeof value.abbreviation === "string" ? value.abbreviation : "",
    logo: typeof value.logo === "string" ? value.logo : "",
  };
}

function normalizeFavoriteTeams(value: unknown): Preferences["favoriteTeams"] {
  return Object.fromEntries(
    LEAGUE_IDS.map((leagueId) => {
      const teams = isObject(value) && Array.isArray(value[leagueId])
        ? value[leagueId]
        : [];
      const seen = new Set<string>();
      const normalized = teams.flatMap((team) => {
        const normalizedTeam = normalizeTeam(team);
        if (!normalizedTeam || seen.has(normalizedTeam.id)) return [];
        seen.add(normalizedTeam.id);
        return [normalizedTeam];
      });
      return [leagueId, normalized];
    }),
  ) as Preferences["favoriteTeams"];
}

export function createDefaultPreferences(): Preferences {
  return {
    version: PREFERENCES_VERSION,
    autoCheckForUpdates: true,
    visibleLeagues: [...LEAGUE_IDS],
    leagueOrder: [...LEAGUE_IDS],
    favoriteTeams: normalizeFavoriteTeams({}),
  };
}

export function normalizePreferences(value: unknown): Preferences {
  const defaults = createDefaultPreferences();
  if (!isObject(value) || value.version !== PREFERENCES_VERSION) return defaults;

  const ordered = Array.isArray(value.leagueOrder) ? value.leagueOrder : [];
  const leagueOrder = [
    ...new Set(ordered.filter(isLeagueId)),
    ...LEAGUE_IDS.filter((league) => !ordered.includes(league)),
  ];
  const visibleLeagues = Array.isArray(value.visibleLeagues)
    ? [...new Set(value.visibleLeagues.filter(isLeagueId))]
    : defaults.visibleLeagues;

  return {
    version: PREFERENCES_VERSION,
    autoCheckForUpdates: value.autoCheckForUpdates !== false,
    visibleLeagues: visibleLeagues.length ? visibleLeagues : defaults.visibleLeagues,
    leagueOrder,
    favoriteTeams: normalizeFavoriteTeams(value.favoriteTeams),
  };
}

export function loadPreferences(
  storage: StorageReader | null = getLocalStorage(),
): Preferences {
  if (!storage) return createDefaultPreferences();
  try {
    const serialized = storage.getItem(PREFERENCES_KEY);
    return serialized ? normalizePreferences(JSON.parse(serialized) as unknown) : createDefaultPreferences();
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferences(
  preferences: unknown,
  storage: StorageWriter | null = getLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function setLeagueVisibility(
  preferences: unknown,
  leagueId: string,
  visible: boolean,
): Preferences {
  const normalized = normalizePreferences(preferences);
  if (!isLeagueId(leagueId)) return normalized;

  const visibleLeagues = visible
    ? [...new Set([...normalized.visibleLeagues, leagueId])]
    : normalized.visibleLeagues.filter((league) => league !== leagueId);
  if (visibleLeagues.length === 0) return normalized;

  return { ...normalized, visibleLeagues };
}

export function moveLeague(
  preferences: unknown,
  leagueId: string,
  direction: number,
): Preferences {
  const normalized = normalizePreferences(preferences);
  if (![-1, 1].includes(direction)) return normalized;

  const index = normalized.leagueOrder.indexOf(leagueId as LeagueId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= normalized.leagueOrder.length) {
    return normalized;
  }

  const leagueOrder = [...normalized.leagueOrder];
  [leagueOrder[index], leagueOrder[targetIndex]] = [
    leagueOrder[targetIndex]!,
    leagueOrder[index]!,
  ];
  return { ...normalized, leagueOrder };
}

export function toggleFavoriteTeam(
  preferences: unknown,
  leagueId: string,
  team: unknown,
): Preferences {
  const normalized = normalizePreferences(preferences);
  const favorite = normalizeTeam(team);
  if (!isLeagueId(leagueId) || !favorite) return normalized;

  const teams = normalized.favoriteTeams[leagueId];
  const favoriteTeams = {
    ...normalized.favoriteTeams,
    [leagueId]: teams.some((existing) => existing.id === favorite.id)
      ? teams.filter((existing) => existing.id !== favorite.id)
      : [...teams, favorite],
  };
  return { ...normalized, favoriteTeams };
}