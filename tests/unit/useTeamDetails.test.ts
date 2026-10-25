import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useTeamDetails } from "../../src/composables/useTeamDetails";
import type { LeagueId } from "../../src/plugins/registry";

function createSelection() {
  return {
    selectedLeague: ref<LeagueId>("nhl"),
    showModal: ref(true),
  };
}

describe("useTeamDetails", () => {
  it("loads team and schedule payloads for the selected league", async () => {
    const selection = createSelection();
    const fetchTeamDetails = vi.fn(async () => ({
      details: { team: "details" },
      schedule: { events: [] },
    }));
    const team = useTeamDetails(selection, { fetchTeamDetails });

    await team.loadTeamDetails("team 1");

    expect(fetchTeamDetails).toHaveBeenCalledWith("nhl", "team 1", globalThis.fetch);
    expect(team.teamData.value).toEqual({ team: "details" });
    expect(team.teamScheduleData.value).toEqual({ events: [] });
    expect(team.teamLoading.value).toBe(false);
  });

  it("ignores results invalidated by a team-view change", async () => {
    const selection = createSelection();
    let resolveRequest: (value: { details: unknown; schedule: unknown }) => void = () => {};
    const fetchTeamDetails = vi.fn(() => new Promise<{ details: unknown; schedule: unknown }>((resolve) => {
      resolveRequest = resolve;
    }));
    const team = useTeamDetails(selection, { fetchTeamDetails });
    const pendingRequest = team.loadTeamDetails("team-1");

    team.resetTeamDetails();
    resolveRequest({ details: { stale: true }, schedule: { stale: true } });
    await pendingRequest;

    expect(team.teamData.value).toBeNull();
    expect(team.teamScheduleData.value).toBeNull();
    expect(team.teamLoading.value).toBe(false);
  });

  it("exposes both detail and schedule errors on request failure", async () => {
    const team = useTeamDetails(createSelection(), {
      fetchTeamDetails: async () => { throw new Error("Offline"); },
    });

    await team.loadTeamDetails("team-1");

    expect(team.teamError.value).toBe("Offline");
    expect(team.scheduleError.value).toBe("Unable to load schedule.");
  });
});