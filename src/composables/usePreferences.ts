import { computed, ref, type Ref } from "vue";
import { fetchStandings } from "../api/espn";
import { LEAGUES } from "../app/leagues";
import {
  moveLeague,
  savePreferences,
  setLeagueVisibility as setLeagueVisibilityPreference,
  toggleFavoriteTeam,
  type Preferences,
} from "../app/preferences";
import { getUniqueStandingTeams, normalizeStandings } from "../domain/standings";
import type { LeagueId } from "../plugins/registry";

type FavoriteTeamOption = ReturnType<typeof getUniqueStandingTeams>[number];
type TeamOptionsByLeague = Partial<Record<LeagueId, FavoriteTeamOption[]>>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function usePreferences(
  preferences: Ref<Preferences>,
  selectedLeague: Ref<LeagueId>,
  fetchImpl: typeof fetch = fetch,
) {
  const settingsOpen = ref(false);
  const favoriteLeague = ref<LeagueId>(selectedLeague.value);
  const favoriteSearch = ref("");
  const teamOptionsByLeague = ref<TeamOptionsByLeague>({});
  const teamOptionsLoading = ref(false);
  const teamOptionsError = ref("");
  let teamOptionsRequestId = 0;

  const selectedFavoriteTeams = computed(
    () => preferences.value.favoriteTeams[favoriteLeague.value] || [],
  );
  const favoriteTeamIds = computed(
    () => (preferences.value.favoriteTeams[selectedLeague.value] || [])
      .map((team) => team.id),
  );
  const filteredTeamOptions = computed(() => {
    const query = favoriteSearch.value.trim().toLocaleLowerCase();
    const teams = teamOptionsByLeague.value[favoriteLeague.value] || [];
    if (!query) return teams;
    return teams.filter((team) =>
      `${team.name} ${team.abbreviation}`.toLocaleLowerCase().includes(query),
    );
  });

  function persistPreferences(nextPreferences: Preferences): void {
    preferences.value = nextPreferences;
    savePreferences(nextPreferences);
  }

  function setAutoCheckForUpdates(enabled: boolean): void {
    persistPreferences({ ...preferences.value, autoCheckForUpdates: enabled });
  }

  async function loadFavoriteTeamOptions(
    leagueId: string,
    force = false,
  ): Promise<void> {
    const league = LEAGUES.find((candidate) => candidate.id === leagueId);
    if (!league) return;

    const requestId = ++teamOptionsRequestId;
    teamOptionsError.value = "";
    if (!force && teamOptionsByLeague.value[league.id]) {
      teamOptionsLoading.value = false;
      return;
    }
    teamOptionsLoading.value = true;
    try {
      const response = await fetchStandings(league.id, fetchImpl);
      const teams = getUniqueStandingTeams(
        normalizeStandings(response, { league: league.id }),
      );
      if (!teams.length) throw new Error("No teams were returned for this league.");
      if (requestId !== teamOptionsRequestId) return;
      teamOptionsByLeague.value = {
        ...teamOptionsByLeague.value,
        [league.id]: teams,
      };
    } catch (error) {
      if (requestId === teamOptionsRequestId) {
        teamOptionsError.value = getErrorMessage(error, "Unable to load teams.");
      }
    } finally {
      if (requestId === teamOptionsRequestId) teamOptionsLoading.value = false;
    }
  }

  function handleFavoriteLeagueChange(): void {
    favoriteSearch.value = "";
    void loadFavoriteTeamOptions(favoriteLeague.value);
  }

  function openSettings(): void {
    settingsOpen.value = true;
    favoriteLeague.value = selectedLeague.value;
    favoriteSearch.value = "";
    void loadFavoriteTeamOptions(favoriteLeague.value);
  }

  function closeSettings(): void {
    settingsOpen.value = false;
    teamOptionsRequestId++;
    teamOptionsLoading.value = false;
  }

  function setLeagueVisibility(leagueId: string, visible: boolean): LeagueId | null {
    const nextPreferences = setLeagueVisibilityPreference(
      preferences.value,
      leagueId,
      visible,
    );
    persistPreferences(nextPreferences);
    if (visible || selectedLeague.value !== leagueId) return null;

    return nextPreferences.leagueOrder.find((league) =>
      nextPreferences.visibleLeagues.includes(league),
    ) ?? null;
  }

  function moveLeagueInOrder(leagueId: string, direction: number): void {
    persistPreferences(moveLeague(preferences.value, leagueId, direction));
  }

  function toggleFavorite(team: unknown): void {
    persistPreferences(
      toggleFavoriteTeam(preferences.value, favoriteLeague.value, team),
    );
  }

  function isFavoriteTeam(teamId: string | number | null | undefined): boolean {
    if (teamId === null || teamId === undefined) return false;
    return selectedFavoriteTeams.value.some((team) => team.id === String(teamId));
  }

  return {
    settingsOpen,
    favoriteLeague,
    favoriteSearch,
    selectedFavoriteTeams,
    favoriteTeamIds,
    filteredTeamOptions,
    teamOptionsByLeague,
    teamOptionsLoading,
    teamOptionsError,
    persistPreferences,
    setAutoCheckForUpdates,
    loadFavoriteTeamOptions,
    handleFavoriteLeagueChange,
    openSettings,
    closeSettings,
    setLeagueVisibility,
    moveLeagueInOrder,
    toggleFavorite,
    isFavoriteTeam,
  };
}