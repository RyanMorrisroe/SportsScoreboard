import { ref, type ComputedRef, type Ref } from "vue";
import {
  fetchJson as requestJson,
  getScoreboardRequestParams,
  getScoreboardUrl,
} from "../api/espn";
import { isBeforeFootballWeekStart } from "../app/scoreboard";
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
}

type JsonObject = Record<string, unknown>;

export interface ScoreboardEvent extends JsonObject {
  id?: string | number;
  date?: string;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeEvent(value: unknown): ScoreboardEvent | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
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
  const fetch = dependencies.fetchJson ?? requestJson;
  const isBeforeWeekStart = dependencies.isBeforeFootballWeekStart ??
    isBeforeFootballWeekStart;
  let requestId = 0;

  async function fetchScoreboard(
    isInitialBoot = false,
    showLoading = isInitialBoot,
  ): Promise<void> {
    const currentRequestId = ++requestId;
    if (showLoading) loading.value = true;
    try {
      const params = getScoreboardRequestParams(selection.selectedLeague.value, {
        date: selection.selectedDate.value,
        week: selection.week.value,
        seasonType: selection.seasonType.value,
        group: selection.selectedGroup.value,
        initial: isInitialBoot,
      });
      let data = asObject(await fetch(
        getScoreboardUrl(selection.selectedLeague.value, params),
      ));
      if (currentRequestId !== requestId) return;

      const responseWeek = asFiniteNumber(asObject(data.week).number);
      let initialWeek = responseWeek;
      if (
        isInitialBoot &&
        resolveLeague(selection.selectedLeague.value)?.schedule.mode === "week" &&
        isBeforeWeekStart() &&
        Number(responseWeek) > 1
      ) {
        initialWeek = Number(responseWeek) - 1;
        const previousWeekParams = getScoreboardRequestParams(
          selection.selectedLeague.value,
          {
            week: initialWeek,
            seasonType: asFiniteNumber(asObject(data.season).type) ??
              selection.seasonType.value,
            group: selection.selectedGroup.value,
          },
        );
        data = asObject(await fetch(
          getScoreboardUrl(selection.selectedLeague.value, previousWeekParams),
        ));
        if (currentRequestId !== requestId) return;
      }

      games.value = Array.isArray(data.events)
        ? data.events.flatMap((event) => {
            const normalizedEvent = normalizeEvent(event);
            return normalizedEvent ? [normalizedEvent] : [];
          })
        : [];

      const finalResponseWeek = asFiniteNumber(asObject(data.week).number);
      if (isInitialBoot && !selection.isDateLeague.value && finalResponseWeek) {
        selection.week.value = initialWeek ?? finalResponseWeek;
        const seasonType = asFiniteNumber(asObject(data.season).type);
        if (seasonType) selection.seasonType.value = seasonType;
        replaceCurrentNavigationEntry();
      }
    } catch (error) {
      if (currentRequestId === requestId) {
        console.error("Scoreboard fetch error:", error);
      }
    } finally {
      if (currentRequestId === requestId && showLoading) loading.value = false;
    }
  }

  function invalidateScoreboard(): void {
    requestId++;
  }

  return { games, loading, fetchScoreboard, invalidateScoreboard };
}