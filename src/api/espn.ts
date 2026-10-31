import { invoke, isTauri } from "@tauri-apps/api/core";
import { gameCache, type GameCache } from "../app/gameCache";
import { resolveLeague } from "../plugins/registry";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_STANDINGS_BASE_URL = "https://site.api.espn.com/apis/v2/sports";

type QueryValue = string | number | null | undefined;
type JsonObject = Record<string, unknown>;

export type CacheFallbackObserver = (url: string, savedAt: number) => void;

export interface FetchJsonOptions {
  cache?: GameCache;
  onCacheFallback?: CacheFallbackObserver;
}

let requestSequence = 0;
const latestSavedRequestByCache = new WeakMap<GameCache, Map<string, number>>();

export interface ScoreboardRequestOptions {
  date?: string;
  week?: number;
  seasonType?: number;
  group?: string;
  initial?: boolean;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (isJsonObject(error) && error.message) return String(error.message);
  return "ESPN request failed";
}

export function getSportPath(league: string): string {
  return resolveLeague(league)?.sportPath || "football";
}

export function getLeagueBaseUrl(league: string): string {
  return `${ESPN_BASE_URL}/${getSportPath(league)}/${league}`;
}

export function getStandingsUrl(
  league: string,
  { group }: { group?: string } = {},
): string {
  const url = `${ESPN_STANDINGS_BASE_URL}/${getSportPath(league)}/${league}/standings`;
  return group ? `${url}?group=${encodeURIComponent(group)}` : url;
}

export function getTeamUrls(
  league: string,
  teamId: string,
): {
  details: string;
  schedule: string;
} {
  const baseUrl = `${getLeagueBaseUrl(league)}/teams/${encodeURIComponent(teamId)}`;
  return {
    details: baseUrl,
    schedule: `${baseUrl}/schedule`,
  };
}

export function getScoreboardRequestParams(
  league: string,
  {
    date,
    week,
    seasonType,
    group,
    initial = false,
  }: ScoreboardRequestOptions = {},
): Record<string, QueryValue> {
  const behavior = resolveLeague(league);
  if (behavior?.schedule.mode === "date") {
    return date ? { dates: String(date).replace(/-/g, "") } : {};
  }

  const params: Record<string, QueryValue> = {};
  if (!initial) {
    params.week = week;
    if (behavior?.schedule.includesSeasonType ?? true) {
      params.seasontype = seasonType;
    }
  }
  if (behavior?.schedule.supportsGroupFilter && group) {
    params.groups = group;
  }
  return params;
}

export function getScoreboardUrl(
  league: string,
  params: Readonly<Record<string, QueryValue>> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString();
  return `${getLeagueBaseUrl(league)}/scoreboard${queryString ? `?${queryString}` : ""}`;
}

export function getGameSummaryUrl(league: string, eventId: string): string {
  return `${getLeagueBaseUrl(league)}/summary?event=${encodeURIComponent(eventId)}`;
}

export async function fetchJson(
  url: string,
  fetchImpl: typeof fetch = fetch,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const cache = options.cache ?? gameCache;
  const currentRequestSequence = ++requestSequence;
  let data: unknown;
  try {
    if (isTauri()) {
      try {
        data = await invoke<unknown>("fetch_espn", { url });
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    } else {
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`ESPN request failed (${response.status})`);
      }
      data = await response.json();
    }
  } catch (error) {
    let cachedResponse = null;
    try {
      cachedResponse = await cache.getResponse(url);
    } catch {
      cachedResponse = null;
    }
    if (cachedResponse) {
      try {
        options.onCacheFallback?.(url, cachedResponse.savedAt);
      } catch {
        // A cache observer must not affect the request result.
      }
      return cachedResponse.value;
    }
    throw error;
  }

  let latestSavedRequest = latestSavedRequestByCache.get(cache);
  if (!latestSavedRequest) {
    latestSavedRequest = new Map();
    latestSavedRequestByCache.set(cache, latestSavedRequest);
  }
  if (currentRequestSequence >= (latestSavedRequest.get(url) ?? 0)) {
    latestSavedRequest.set(url, currentRequestSequence);
    await cache.saveResponse(url, data).catch(() => {});
  }
  return data;
}

export async function fetchTeamDetails(
  league: string,
  teamId: string,
  fetchImpl: typeof fetch = fetch,
  options: FetchJsonOptions = {},
): Promise<{ details: unknown; schedule: unknown }> {
  const urls = getTeamUrls(league, teamId);
  const [details, schedule] = await Promise.all([
    fetchJson(urls.details, fetchImpl, options),
    fetchJson(urls.schedule, fetchImpl, options),
  ]);
  return { details, schedule };
}

export async function fetchStandings(
  league: string,
  fetchImpl: typeof fetch = fetch,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const standings = await fetchJson(
    getStandingsUrl(league),
    fetchImpl,
    options,
  );
  if (
    !isJsonObject(standings) ||
    !Array.isArray(standings.children) ||
    standings.children.length === 0
  ) {
    return standings;
  }

  const children = await Promise.all(
    standings.children.map(async (value) => {
      if (!isJsonObject(value)) return value;
      const group = value;
      if (
        !group.id ||
        (Array.isArray(group.children) && group.children.length > 0)
      ) {
        return group;
      }
      const subgroupData = await fetchJson(
        getStandingsUrl(league, { group: String(group.id) }),
        fetchImpl,
        options,
      );
      return isJsonObject(subgroupData) &&
        Array.isArray(subgroupData.children) &&
        subgroupData.children.length > 0
        ? { ...group, children: subgroupData.children }
        : group;
    }),
  );
  return { ...standings, children };
}
