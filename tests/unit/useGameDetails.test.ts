import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGameDetails } from "../../src/composables/useGameDetails";
import type { LeagueId } from "../../src/plugins/registry";

function createSelection() {
  return {
    selectedLeague: ref<LeagueId>("nba"),
    showModal: ref(true),
    modalView: ref("game"),
    selectedGame: ref<{ id: string | number; status?: unknown } | null>({
      id: "event-1",
      status: { type: { state: "pre" } },
    }),
    modalTab: ref("matchup"),
  };
}

describe("useGameDetails", () => {
  it("normalizes game summaries and loads missing matchup schedules", async () => {
    const selection = createSelection();
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("/summary")) {
        return {
          header: {
            competitions: [{
              status: { type: { state: "in" } },
              competitors: [{ id: "away" }, { id: "home" }],
            }],
          },
          boxscore: { teams: [] },
        };
      }
      return { events: [] };
    });
    const details = useGameDetails(selection, { fetchJson });

    await details.fetchGameDetail("event-1");
    await vi.waitFor(() => expect(details.matchupSchedules.value).toEqual({
      away: { events: [] },
      home: { events: [] },
    }));

    expect(details.modalData.value?.id).toBe("event-1");
    expect(details.modalGameStatus.value).toBe("in");
    expect(selection.modalTab.value).toBe("stats");
    expect(fetchJson.mock.calls.map(([url]) => url)).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=event-1",
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/away/schedule",
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/home/schedule",
    ]);
  });

  it("does not commit a summary after its event is no longer active", async () => {
    const selection = createSelection();
    let resolveSummary: (value: unknown) => void = () => {};
    const fetchJson = vi.fn(() => new Promise<unknown>((resolve) => {
      resolveSummary = resolve;
    }));
    const details = useGameDetails(selection, { fetchJson });
    const pendingRequest = details.fetchGameDetail("event-1");

    selection.showModal.value = false;
    resolveSummary({ header: { competitions: [] } });
    await pendingRequest;

    expect(details.modalData.value).toBeNull();
    expect(details.modalLoading.value).toBe(false);
  });

  it("does not fetch schedules for teams already present in matchup data", async () => {
    const selection = createSelection();
    const fetchJson = vi.fn(async () => ({
      header: { competitions: [{ competitors: [{ id: "away" }, { id: "home" }] }] },
      lastFiveGames: [
        { team: { id: "away" }, events: [{ id: "recent-1" }] },
        { team: { id: "home" }, events: [{ id: "recent-2" }] },
      ],
    }));
    const details = useGameDetails(selection, { fetchJson });

    await details.fetchGameDetail("event-1");

    expect(fetchJson).toHaveBeenCalledOnce();
    expect(details.matchupLoading.value).toBe(false);
  });
});
