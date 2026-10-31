import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { GameCache } from "../../src/app/gameCache";
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

function createCache(overrides: Partial<GameCache> = {}): GameCache {
  return {
    getScoreboard: vi.fn(async () => null),
    saveScoreboard: vi.fn(async () => {}),
    getSummary: vi.fn(async () => null),
    saveSummary: vi.fn(async () => {}),
    ...overrides,
  };
}

const completedSummary = {
  header: {
    competitions: [{
      status: { type: { state: "post" } },
      competitors: [],
    }],
  },
  boxscore: { teams: [] },
};

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

  it("keeps existing summary visible when a background refresh fails", async () => {
    const selection = createSelection();
    const fetchJson = vi.fn()
      .mockResolvedValueOnce({
        header: { competitions: [{ status: { type: { state: "in" } } }] },
        boxscore: { teams: [] },
      })
      .mockRejectedValueOnce(new Error("offline"));
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const details = useGameDetails(selection, { fetchJson, cache: createCache() });

    await details.fetchGameDetail("event-1");
    const currentData = details.modalData.value;
    await details.fetchGameDetail("event-1");

    expect(details.modalData.value).toBe(currentData);
    expect(details.modalLoading.value).toBe(false);
    logError.mockRestore();
  });

  it("shows a cached completed summary while revalidating and preserves it offline", async () => {
    const selection = createSelection();
    const cache = createCache({
      getSummary: vi.fn(async () => completedSummary),
    });
    const fetchJson = vi.fn(async () => { throw new Error("offline"); });
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const details = useGameDetails(selection, { fetchJson, cache });

    await details.fetchGameDetail("event-1");

    expect(details.modalData.value?.id).toBe("event-1");
    expect(details.modalGameStatus.value).toBe("post");
    expect(details.modalLoading.value).toBe(false);
    expect(cache.getSummary).toHaveBeenCalledWith("nba", "event-1");
    logError.mockRestore();
  });

  it("records successful summary refreshes and caches completed payloads", async () => {
    const selection = createSelection();
    const cache = createCache();
    const details = useGameDetails(selection, {
      fetchJson: vi.fn(async () => completedSummary),
      cache,
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(5678);

    await details.fetchGameDetail("event-1");

    expect(details.lastSuccessfulRefreshAt.value).toBe(5678);
    expect(cache.saveSummary).toHaveBeenCalledWith("nba", "event-1", completedSummary);
    now.mockRestore();
  });

  it("reports summary refresh failures and clears them on retry", async () => {
    const selection = createSelection();
    const fetchJson = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(completedSummary);
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const details = useGameDetails(selection, {
      fetchJson,
      cache: createCache(),
    });

    const failedRequest = details.fetchGameDetail("event-1");
    expect(details.refreshing.value).toBe(true);
    await failedRequest;
    expect(details.refreshing.value).toBe(false);
    expect(details.refreshFailed.value).toBe(true);

    const retry = details.fetchGameDetail("event-1");
    expect(details.refreshing.value).toBe(true);
    expect(details.refreshFailed.value).toBe(false);
    await retry;
    expect(details.refreshing.value).toBe(false);
    expect(details.refreshFailed.value).toBe(false);
    logError.mockRestore();
  });
});
