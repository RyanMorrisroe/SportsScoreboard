import { LEAGUE_IDS } from "./leagues.js";

const PREFERENCES_KEY = "sports-scoreboard.preferences";
const PREFERENCES_VERSION = 1;

function getLocalStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeTeam(team) {
  if (!team || typeof team !== "object" || team.id === undefined || team.id === null) {
    return null;
  }

  const id = String(team.id).trim();
  if (!id) return null;
  return {
    id,
    name: typeof team.name === "string" && team.name.trim() ? team.name : id,
    abbreviation: typeof team.abbreviation === "string" ? team.abbreviation : "",
    logo: typeof team.logo === "string" ? team.logo : "",
  };
}

function normalizeFavoriteTeams(value) {
  return Object.fromEntries(
    LEAGUE_IDS.map((leagueId) => {
      const teams = Array.isArray(value?.[leagueId]) ? value[leagueId] : [];
      const seen = new Set();
      const normalized = teams.flatMap((team) => {
        const normalizedTeam = normalizeTeam(team);
        if (!normalizedTeam || seen.has(normalizedTeam.id)) return [];
        seen.add(normalizedTeam.id);
        return [normalizedTeam];
      });
      return [leagueId, normalized];
    }),
  );
}

export function createDefaultPreferences() {
  return {
    version: PREFERENCES_VERSION,
    visibleLeagues: [...LEAGUE_IDS],
    leagueOrder: [...LEAGUE_IDS],
    favoriteTeams: normalizeFavoriteTeams({}),
  };
}

export function normalizePreferences(value) {
  const defaults = createDefaultPreferences();
  if (!value || typeof value !== "object" || value.version !== PREFERENCES_VERSION) {
    return defaults;
  }

  const ordered = Array.isArray(value.leagueOrder) ? value.leagueOrder : [];
  const leagueOrder = [
    ...new Set(ordered.filter((league) => LEAGUE_IDS.includes(league))),
    ...LEAGUE_IDS.filter((league) => !ordered.includes(league)),
  ];
  const visibleLeagues = Array.isArray(value.visibleLeagues)
    ? [...new Set(value.visibleLeagues.filter((league) => LEAGUE_IDS.includes(league)))]
    : defaults.visibleLeagues;

  return {
    version: PREFERENCES_VERSION,
    visibleLeagues: visibleLeagues.length ? visibleLeagues : defaults.visibleLeagues,
    leagueOrder,
    favoriteTeams: normalizeFavoriteTeams(value.favoriteTeams),
  };
}

export function loadPreferences(storage = getLocalStorage()) {
  if (!storage) return createDefaultPreferences();
  try {
    const serialized = storage.getItem(PREFERENCES_KEY);
    return serialized ? normalizePreferences(JSON.parse(serialized)) : createDefaultPreferences();
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferences(preferences, storage = getLocalStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function setLeagueVisibility(preferences, leagueId, visible) {
  const normalized = normalizePreferences(preferences);
  if (!LEAGUE_IDS.includes(leagueId)) return normalized;

  const visibleLeagues = visible
    ? [...new Set([...normalized.visibleLeagues, leagueId])]
    : normalized.visibleLeagues.filter((league) => league !== leagueId);
  if (visibleLeagues.length === 0) return normalized;

  return { ...normalized, visibleLeagues };
}

export function moveLeague(preferences, leagueId, direction) {
  const normalized = normalizePreferences(preferences);
  if (![-1, 1].includes(direction)) return normalized;

  const index = normalized.leagueOrder.indexOf(leagueId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= normalized.leagueOrder.length) {
    return normalized;
  }

  const leagueOrder = [...normalized.leagueOrder];
  [leagueOrder[index], leagueOrder[targetIndex]] = [
    leagueOrder[targetIndex],
    leagueOrder[index],
  ];
  return { ...normalized, leagueOrder };
}

export function toggleFavoriteTeam(preferences, leagueId, team) {
  const normalized = normalizePreferences(preferences);
  const favorite = normalizeTeam(team);
  if (!LEAGUE_IDS.includes(leagueId) || !favorite) return normalized;

  const teams = normalized.favoriteTeams[leagueId];
  const favoriteTeams = {
    ...normalized.favoriteTeams,
    [leagueId]: teams.some((existing) => existing.id === favorite.id)
      ? teams.filter((existing) => existing.id !== favorite.id)
      : [...teams, favorite],
  };
  return { ...normalized, favoriteTeams };
}