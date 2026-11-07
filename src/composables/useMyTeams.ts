import { computed, ref, watch, type Ref } from "vue";
import {
  fetchJson as requestJson,
  getGameSummaryUrl,
  getTeamUrls,
  type FetchJsonOptions,
} from "../api/espn";
import { LEAGUE_IDS } from "../app/leagues";
import type { FavoriteTeam, Preferences } from "../app/preferences";
import {
  buildGameDetail,
  type GameDetail,
  type GameDetailTeam,
} from "../domain/game";
import {
  filterMyTeamsScheduleEntries,
  normalizeSchedule,
  type NormalizedScheduleEntry,
} from "../domain/schedule";
import type { LeagueId } from "../plugins/registry";

const MAX_CONCURRENT_SCHEDULES = 4;
const MAX_CONCURRENT_SUMMARIES = 4;

interface FavoriteSchedule {
  key: string;
  league: LeagueId;
  team: FavoriteTeam;
}

interface TeamScheduleState extends FavoriteSchedule {
  loading: boolean;
  error: string;
  cachedAt: number | null;
  entries: NormalizedScheduleEntry[];
}

export interface MyTeamsGame extends NormalizedScheduleEntry {
  league: LeagueId;
  favoriteTeams: FavoriteTeam[];
  awayTeam?: GameDetailTeam;
  homeTeam?: GameDetailTeam;
  summaryCachedAt?: number | null;
  summaryLastUpdatedAt?: number | null;
  summaryRefreshFailed?: boolean;
}

interface LiveGameDetails {
  detail: GameDetail;
  cachedAt: number | null;
  lastUpdatedAt: number;
  refreshFailed: boolean;
}

interface MyTeamsDependencies {
  fetchJson: (
    url: string,
    fetchImpl: typeof fetch,
    options: FetchJsonOptions,
  ) => Promise<unknown>;
  fetchImpl: typeof fetch;
  now: () => number;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load schedule.";
}

function hasSummaryScores(raw: unknown): boolean {
  const header = asObject(asObject(raw).header);
  const competition = asObject(asArray(header.competitions)[0]);
  const competitors = asArray(competition.competitors).map(asObject);
  return (["away", "home"] as const).every((side) => {
    const score = competitors.find(
      (competitor) => competitor.homeAway === side,
    )?.score;
    return (
      (typeof score === "string" && score.trim() !== "") ||
      (typeof score === "number" && Number.isFinite(score))
    );
  });
}

async function runWithConcurrency<T>(
  values: T[],
  limit: number,
  callback: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(limit, values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        await callback(values[index]!);
      }
    }),
  );
}

export function useMyTeams(
  preferences: Ref<Preferences>,
  dependencies: Partial<MyTeamsDependencies> = {},
) {
  const fetchJson = dependencies.fetchJson ?? requestJson;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const getNow = dependencies.now ?? Date.now;
  const scheduleStates = ref<Record<string, TeamScheduleState>>({});
  const liveDetails = ref<Record<string, LiveGameDetails>>({});
  const hasLoaded = ref(false);
  const now = ref(getNow());
  const activeSummaryRequests = new Map<string, Promise<void>>();
  const favoriteGenerations = new Map<string, number>();
  let activeLoad: Promise<void> | null = null;
  let activePassForce = false;
  let loadAgain = false;
  let forceAgain = false;
  let skippedSummaryKey: string | null = null;

  const favoriteSchedules = computed<FavoriteSchedule[]>(() =>
    LEAGUE_IDS.flatMap((league) =>
      preferences.value.favoriteTeams[league].map((team) => ({
        key: `${league}:${team.id}`,
        league,
        team,
      })),
    ),
  );

  watch(
    () => favoriteSchedules.value.map(({ key }) => key),
    (keys, previousKeys) => {
      const currentKeys = new Set(keys);
      const removedKeys = previousKeys.filter((key) => !currentKeys.has(key));
      if (!removedKeys.length) return;

      const nextStates = { ...scheduleStates.value };
      for (const key of removedKeys) {
        favoriteGenerations.set(key, (favoriteGenerations.get(key) ?? 0) + 1);
        delete nextStates[key];
      }
      scheduleStates.value = nextStates;
    },
    { flush: "sync" },
  );

  const teamSchedules = computed(() =>
    favoriteSchedules.value.map((favorite) => {
      const state = scheduleStates.value[favorite.key];
      return {
        ...favorite,
        loading: state?.loading ?? false,
        error: state?.error ?? "",
        cachedAt: state?.cachedAt ?? null,
      };
    }),
  );

  const scheduleGames = computed<MyTeamsGame[]>(() => {
    const byEvent = new Map<string, MyTeamsGame>();
    for (const favorite of favoriteSchedules.value) {
      const entries = scheduleStates.value[favorite.key]?.entries ?? [];
      for (const entry of filterMyTeamsScheduleEntries(entries, now.value)) {
        if (String(entry.id).trim() === "") continue;
        const eventKey = `${favorite.league}:${entry.id}`;
        const existing = byEvent.get(eventKey);
        if (existing) {
          if (
            !existing.favoriteTeams.some((team) => team.id === favorite.team.id)
          ) {
            existing.favoriteTeams.push(favorite.team);
          }
          continue;
        }
        byEvent.set(eventKey, {
          ...entry,
          league: favorite.league,
          favoriteTeams: [favorite.team],
        });
      }
    }
    return [...byEvent.values()].sort((first, second) => {
      const stateOrder =
        Number(first.state !== "in") - Number(second.state !== "in");
      return (
        stateOrder ||
        (first.startTime ?? now.value) - (second.startTime ?? now.value) ||
        first.league.localeCompare(second.league)
      );
    });
  });

  const games = computed<MyTeamsGame[]>(() =>
    scheduleGames.value.map((game) => {
      const details = liveDetails.value[`${game.league}:${game.id}`];
      if (!details) return game;
      return {
        ...game,
        awayTeam: details.detail.teams.away,
        homeTeam: details.detail.teams.home,
        summaryCachedAt: details.cachedAt,
        summaryLastUpdatedAt: details.lastUpdatedAt,
        summaryRefreshFailed: details.refreshFailed,
      };
    }),
  );

  const loading = computed(() =>
    teamSchedules.value.some((schedule) => schedule.loading),
  );
  const failedSchedules = computed(() =>
    teamSchedules.value.filter((schedule) => schedule.error),
  );

  function isStillFavorite(favorite: FavoriteSchedule): boolean {
    return favoriteSchedules.value.some(({ key }) => key === favorite.key);
  }

  function updateState(key: string, state: TeamScheduleState): void {
    scheduleStates.value = { ...scheduleStates.value, [key]: state };
  }

  async function fetchSchedule(favorite: FavoriteSchedule): Promise<void> {
    const previous = scheduleStates.value[favorite.key];
    const generation = favoriteGenerations.get(favorite.key) ?? 0;
    const isCurrentFavorite = () =>
      isStillFavorite(favorite) &&
      (favoriteGenerations.get(favorite.key) ?? 0) === generation;
    let cachedAt: number | null = null;
    try {
      const url = getTeamUrls(favorite.league, favorite.team.id).schedule;
      const payload = await fetchJson(url, fetchImpl, {
        onCacheFallback: (_fallbackUrl, savedAt) => {
          cachedAt = savedAt;
        },
      });
      if (!isCurrentFavorite()) return;
      updateState(favorite.key, {
        ...favorite,
        loading: false,
        error: "",
        cachedAt,
        entries: normalizeSchedule(payload, favorite.team.id),
      });
    } catch (error) {
      if (!isCurrentFavorite()) return;
      updateState(favorite.key, {
        ...favorite,
        loading: false,
        error: getErrorMessage(error),
        cachedAt: cachedAt ?? previous?.cachedAt ?? null,
        entries: previous?.entries ?? [],
      });
    }
  }

  function isStillLiveScheduleEvent(eventKey: string): boolean {
    return scheduleGames.value.some(
      (game) => `${game.league}:${game.id}` === eventKey && game.state === "in",
    );
  }

  async function fetchLiveSummary(game: MyTeamsGame): Promise<void> {
    const eventKey = `${game.league}:${game.id}`;
    const activeRequest = activeSummaryRequests.get(eventKey);
    if (activeRequest) {
      await activeRequest;
      return;
    }

    const request = (async () => {
      let cachedAt: number | null = null;
      try {
        const payload = await fetchJson(
          getGameSummaryUrl(game.league, String(game.id)),
          fetchImpl,
          {
            onCacheFallback: (_url, savedAt) => {
              cachedAt = savedAt;
            },
          },
        );
        if (!isStillLiveScheduleEvent(eventKey) || !hasSummaryScores(payload))
          return;
        const detail = buildGameDetail(payload, game.id);
        liveDetails.value = {
          ...liveDetails.value,
          [eventKey]: {
            detail,
            cachedAt,
            lastUpdatedAt: cachedAt ?? getNow(),
            refreshFailed: false,
          },
        };
      } catch {
        const previous = liveDetails.value[eventKey];
        if (previous) {
          liveDetails.value = {
            ...liveDetails.value,
            [eventKey]: { ...previous, refreshFailed: true },
          };
        }
      }
    })();
    activeSummaryRequests.set(eventKey, request);
    try {
      await request;
    } finally {
      if (activeSummaryRequests.get(eventKey) === request) {
        activeSummaryRequests.delete(eventKey);
      }
    }
  }

  async function loadLiveSummaries(): Promise<void> {
    const games = scheduleGames.value;
    const liveKeys = new Set(
      games
        .filter((game) => game.state === "in")
        .map((game) => `${game.league}:${game.id}`),
    );
    liveDetails.value = Object.fromEntries(
      Object.entries(liveDetails.value).filter(([key]) => liveKeys.has(key)),
    );
    const uniqueLiveGames = games.filter(
      (game) =>
        game.state === "in" &&
        `${game.league}:${game.id}` !== skippedSummaryKey,
    );
    await runWithConcurrency(
      uniqueLiveGames,
      MAX_CONCURRENT_SUMMARIES,
      fetchLiveSummary,
    );
  }

  async function loadSchedules(force: boolean): Promise<void> {
    const favorites = favoriteSchedules.value;
    const favoriteKeys = new Set(favorites.map(({ key }) => key));
    scheduleStates.value = Object.fromEntries(
      Object.entries(scheduleStates.value).filter(([key]) =>
        favoriteKeys.has(key),
      ),
    );
    now.value = getNow();
    hasLoaded.value = true;

    const pending = favorites.filter(
      ({ key }) => force || !scheduleStates.value[key],
    );
    for (const favorite of pending) {
      const previous = scheduleStates.value[favorite.key];
      updateState(favorite.key, {
        ...favorite,
        loading: true,
        error: "",
        cachedAt: previous?.cachedAt ?? null,
        entries: previous?.entries ?? [],
      });
    }
    await runWithConcurrency(pending, MAX_CONCURRENT_SCHEDULES, fetchSchedule);
  }

  async function load(
    force = false,
    skipSummaryEventKey: string | null = null,
  ): Promise<void> {
    skippedSummaryKey = skipSummaryEventKey;
    if (activeLoad) {
      if (!force) {
        loadAgain = true;
      } else if (!activePassForce || loadAgain) {
        loadAgain ||= !activePassForce;
        forceAgain = true;
      }
      await activeLoad;
      return;
    }

    activeLoad = (async () => {
      let nextForce = force;
      do {
        loadAgain = false;
        activePassForce = nextForce;
        await loadSchedules(nextForce);
        await loadLiveSummaries();
        nextForce = forceAgain;
        forceAgain = false;
      } while (loadAgain);
    })();
    try {
      await activeLoad;
    } finally {
      activeLoad = null;
      activePassForce = false;
    }
  }

  return {
    games,
    teamSchedules,
    failedSchedules,
    loading,
    hasLoaded,
    now,
    load,
  };
}
