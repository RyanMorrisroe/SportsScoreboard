import { ref, type Ref } from "vue";
import { fetchStandings as requestStandings } from "../api/espn";
import {
  getStandingPositionKey,
  normalizeStandings,
  sortStandingTeams,
  type StandingGroup,
  type StandingTeam,
} from "../domain/standings";
import type { LeagueId } from "../plugins/registry";
import { useCacheProvenance } from "./useCacheProvenance";

type SortDirection = "asc" | "desc";

interface StandingSort {
  key: string;
  direction: SortDirection;
}

type StandingSortByGroup = Record<string, StandingSort>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load standings.";
}

export function useStandings(
  selectedLeague: Ref<LeagueId>,
  fetchImpl: typeof fetch = fetch,
) {
  const standings = ref<StandingGroup[]>([]);
  const standingsLoading = ref(false);
  const standingsError = ref("");
  const standingsSort = ref<StandingSortByGroup>({});
  const provenance = useCacheProvenance();
  let requestId = 0;
  let activeLeague = selectedLeague.value;

  async function fetchStandings(): Promise<void> {
    const currentRequestId = ++requestId;
    const league = selectedLeague.value;
    if (league !== activeLeague) {
      activeLeague = league;
      provenance.clear();
    }
    let responseUsedCache = false;
    const onCacheFallback = (url: string, savedAt: number) => {
      if (currentRequestId !== requestId) return;
      responseUsedCache = true;
      provenance.onCacheFallback(url, savedAt);
    };
    standingsLoading.value = true;
    standingsError.value = "";
    try {
      const response = await requestStandings(league, fetchImpl, {
        onCacheFallback,
      });
      if (currentRequestId !== requestId) return;
      standings.value = normalizeStandings(response, {
        league,
      });
      if (!responseUsedCache) provenance.clear();
      const initialSort: StandingSortByGroup = {};
      for (const group of standings.value) {
        const key = getStandingPositionKey(group);
        if (key) initialSort[group.id] = { key, direction: "asc" };
      }
      standingsSort.value = initialSort;
    } catch (error) {
      if (currentRequestId === requestId) {
        standingsError.value = getErrorMessage(error);
        console.error("Standings fetch error:", error);
      }
    } finally {
      if (currentRequestId === requestId) standingsLoading.value = false;
    }
  }

  function resetStandings(): void {
    requestId++;
    standings.value = [];
    standingsLoading.value = false;
    standingsError.value = "";
    provenance.clear();
  }

  function getStandingStat(team: StandingTeam, key: string): unknown {
    return team.stats.find((stat) => stat.key === key)?.value ?? "--";
  }

  function getStandingSortDirection(
    groupId: string,
    key: string,
  ): SortDirection | null {
    return standingsSort.value[groupId]?.key === key
      ? standingsSort.value[groupId]!.direction
      : null;
  }

  function toggleStandingsSort(groupId: string, key: string): void {
    const current = standingsSort.value[groupId];
    if (current?.key !== key) {
      standingsSort.value = {
        ...standingsSort.value,
        [groupId]: { key, direction: "asc" },
      };
    } else if (current.direction === "asc") {
      standingsSort.value = {
        ...standingsSort.value,
        [groupId]: { key, direction: "desc" },
      };
    } else {
      const nextSort = { ...standingsSort.value };
      delete nextSort[groupId];
      standingsSort.value = nextSort;
    }
  }

  function getSortedStandingTeams(group: StandingGroup): StandingTeam[] {
    const sort = standingsSort.value[group.id];
    return sort
      ? sortStandingTeams(group.teams, sort.key, sort.direction)
      : group.teams;
  }

  return {
    standings,
    standingsLoading,
    standingsError,
    showingCachedData: provenance.showingCachedData,
    cachedAt: provenance.cachedAt,
    fetchStandings,
    resetStandings,
    getStandingStat,
    getStandingSortDirection,
    toggleStandingsSort,
    getSortedStandingTeams,
  };
}
