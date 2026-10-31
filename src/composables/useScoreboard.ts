import { ref, type ComputedRef, type Ref } from "vue";
import {
  fetchJson as requestJson,
  getScoreboardRequestParams,
  getScoreboardUrl,
} from "../api/espn";
import { gameCache, type GameCache } from "../app/gameCache";
import { isBeforeFootballWeekStart } from "../app/scoreboard";
import { useCacheProvenance } from "./useCacheProvenance";
import type { LeagueId } from "../plugins/registry";
import { resolveLeague } from "../plugins/registry";

interface ScoreboardSelection {
  selectedLeague: Ref<LeagueId>;
  selectedDate: Ref<string>;
  week: Ref<number>;
  seasonType: Ref<number>;
  selectedGroup: Ref<string>;
  isDateLeague: ComputedRef<boolean>;
}

interface ScoreboardDependencies {
  fetchJson: (url: string) => Promise<unknown>;
  isBeforeFootballWeekStart: () => boolean;
  cache: GameCache;
}

type JsonObject = Record<string, unknown>;

export interface ScoreboardEvent extends JsonObject {
  id?: string | number;
  date?: string;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeEvent(value: unknown): ScoreboardEvent | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const event = value as JsonObject;
  const id = event.id;
  const date = event.date;
  return {
    ...event,
    ...(typeof id === "string" || typeof id === "number" ? { id } : {}),
    ...(typeof date === "string" ? { date } : {}),
  };
}

export function useScoreboard(
  selection: ScoreboardSelection,
  replaceCurrentNavigationEntry: () => void,
  dependencies: Partial<ScoreboardDependencies> = {},
) {
  const games = ref<ScoreboardEvent[]>([]);
  const loading = ref(false);
  const refreshing = ref(false);
  const refreshFailed = ref(false);
  const lastSuccessfulRefreshAt = ref<number | null>(null);
  const cache = dependencies.cache ?? gameCache;
  const provenance = useCacheProvenance();
  const fetch = (
    url: string,
    onCacheFallback: (url: string, savedAt: number) => void,
  ) =>
    dependencies.fetchJson
      ? dependencies.fetchJson(url)
      : requestJson(url, undefined, { cache, onCacheFallback });
  const isBeforeWeekStart =
    dependencies.isBeforeFootballWeekStart ?? isBeforeFootballWeekStart;
  let requestId = 0;
  let hydratedRequestUrl: string | null = null;

  async function fetchScoreboard(
    isInitialBoot = false,
    showLoading = isInitialBoot,
  ): Promise<void> {
    const currentRequestId = ++requestId;
    let responseUsedCache = false;
    const onCacheFallback = (url: string, savedAt: number) => {
      if (currentRequestId !== requestId) return;
      responseUsedCache = true;
      provenance.onCacheFallback(url, savedAt);
    };
    refreshing.value = true;
    refreshFailed.value = false;
    if (showLoading) loading.value = true;
    try {
      const params = getScoreboardRequestParams(
        selection.selectedLeague.value,
        {
          date: selection.selectedDate.value,
          week: selection.week.value,
          seasonType: selection.seasonType.value,
          group: selection.selectedGroup.value,
          initial: isInitialBoot,
        },
      );
      let requestUrl = getScoreboardUrl(selection.selectedLeague.value, params);
      if (requestUrl !== hydratedRequestUrl) {
        provenance.clear();
        lastSuccessfulRefreshAt.value = null;
        let cachedEvents: unknown[] | null = null;
        let hasCachedSnapshot = false;
        try {
          const cachedResponse = await cache.getResponse(requestUrl);
          if (cachedResponse) {
            hasCachedSnapshot = true;
            provenance.markCached(cachedResponse.savedAt);
            const cachedData = asObject(cachedResponse.value);
            cachedEvents = Array.isArray(cachedData.events)
              ? cachedData.events
              : [];
          } else {
            cachedEvents = await cache.getScoreboard(
              selection.selectedLeague.value,
              requestUrl,
            );
            hasCachedSnapshot = Boolean(cachedEvents?.length);
            if (hasCachedSnapshot) provenance.markCached();
          }
        } catch {
          cachedEvents = null;
        }
        if (currentRequestId !== requestId) return;
        hydratedRequestUrl = requestUrl;
        if (hasCachedSnapshot && cachedEvents) {
          games.value = cachedEvents.flatMap((event) => {
            const normalizedEvent = normalizeEvent(event);
            return normalizedEvent ? [normalizedEvent] : [];
          });
          if (showLoading) loading.value = false;
        }
      }

      let data = asObject(await fetch(requestUrl, onCacheFallback));
      let displayedResponseUsedCache = responseUsedCache;
      if (currentRequestId !== requestId) return;

      const responseWeek = asFiniteNumber(asObject(data.week).number);
      let initialWeek = responseWeek;
      if (
        isInitialBoot &&
        resolveLeague(selection.selectedLeague.value)?.schedule.mode ===
          "week" &&
        isBeforeWeekStart() &&
        Number(responseWeek) > 1
      ) {
        initialWeek = Number(responseWeek) - 1;
        const previousWeekParams = getScoreboardRequestParams(
          selection.selectedLeague.value,
          {
            week: initialWeek,
            seasonType:
              asFiniteNumber(asObject(data.season).type) ??
              selection.seasonType.value,
            group: selection.selectedGroup.value,
          },
        );
        requestUrl = getScoreboardUrl(
          selection.selectedLeague.value,
          previousWeekParams,
        );
        responseUsedCache = false;
        data = asObject(await fetch(requestUrl, onCacheFallback));
        displayedResponseUsedCache = responseUsedCache;
        if (currentRequestId !== requestId) return;
      }

      games.value = Array.isArray(data.events)
        ? data.events.flatMap((event) => {
            const normalizedEvent = normalizeEvent(event);
            return normalizedEvent ? [normalizedEvent] : [];
          })
        : [];
      if (displayedResponseUsedCache) {
        refreshFailed.value = true;
      } else {
        provenance.clear();
        lastSuccessfulRefreshAt.value = Date.now();
      }

      const finalResponseWeek = asFiniteNumber(asObject(data.week).number);
      if (isInitialBoot && !selection.isDateLeague.value && finalResponseWeek) {
        selection.week.value = initialWeek ?? finalResponseWeek;
        const seasonType = asFiniteNumber(asObject(data.season).type);
        if (seasonType) selection.seasonType.value = seasonType;
        replaceCurrentNavigationEntry();
      }
    } catch (error) {
      if (currentRequestId === requestId) {
        refreshFailed.value = true;
        console.error("Scoreboard fetch error:", error);
      }
    } finally {
      if (currentRequestId === requestId) {
        refreshing.value = false;
        if (showLoading) loading.value = false;
      }
    }
  }

  function invalidateScoreboard(): void {
    requestId++;
    refreshing.value = false;
    refreshFailed.value = false;
  }

  return {
    games,
    loading,
    refreshing,
    refreshFailed,
    lastSuccessfulRefreshAt,
    showingCachedData: provenance.showingCachedData,
    cachedAt: provenance.cachedAt,
    fetchScoreboard,
    invalidateScoreboard,
  };
}
