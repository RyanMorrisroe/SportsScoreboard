import { ref, type Ref } from "vue";
import { fetchTeamDetails as requestTeamDetails } from "../api/espn";
import type { LeagueId } from "../plugins/registry";

interface TeamDetailsSelection {
  selectedLeague: Ref<LeagueId>;
  showModal: Ref<boolean>;
}

interface TeamDetailsDependencies {
  fetchTeamDetails: (
    league: string,
    teamId: string,
    fetchImpl?: typeof fetch,
  ) => Promise<{ details: unknown; schedule: unknown }>;
  fetchImpl: typeof fetch;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error !== null && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message) return message;
  }
  return "Unable to load team details.";
}

export function useTeamDetails(
  selection: TeamDetailsSelection,
  dependencies: Partial<TeamDetailsDependencies> = {},
) {
  const teamData = ref<unknown>(null);
  const teamScheduleData = ref<unknown>(null);
  const teamLoading = ref(false);
  const teamError = ref("");
  const scheduleError = ref("");
  const fetchDetails = dependencies.fetchTeamDetails ?? requestTeamDetails;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  let requestId = 0;

  async function loadTeamDetails(teamId: string | number): Promise<void> {
    const currentRequestId = ++requestId;
    teamData.value = null;
    teamScheduleData.value = null;
    teamError.value = "";
    scheduleError.value = "";
    teamLoading.value = true;
    try {
      const result = await fetchDetails(
        selection.selectedLeague.value,
        String(teamId),
        fetchImpl,
      );
      if (currentRequestId !== requestId || !selection.showModal.value) return;
      teamData.value = result.details;
      teamScheduleData.value = result.schedule;
    } catch (error) {
      if (currentRequestId === requestId) {
        teamError.value = getErrorMessage(error);
        scheduleError.value = "Unable to load schedule.";
      }
    } finally {
      if (currentRequestId === requestId) teamLoading.value = false;
    }
  }

  function invalidateTeamDetails(): void {
    requestId++;
  }

  function resetTeamDetails(): void {
    invalidateTeamDetails();
    teamData.value = null;
    teamScheduleData.value = null;
    teamLoading.value = false;
    teamError.value = "";
    scheduleError.value = "";
  }

  return {
    teamData,
    teamScheduleData,
    teamLoading,
    teamError,
    scheduleError,
    loadTeamDetails,
    invalidateTeamDetails,
    resetTeamDetails,
  };
}