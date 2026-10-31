import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { GameCache } from "../../src/app/gameCache";
import { useScoreboard } from "../../src/composables/useScoreboard";
import { resolveLeague, type LeagueId } from "../../src/plugins/registry";

function createSelection(league: LeagueId) {
  const selectedLeague = ref(league);
  return {
    selectedLeague,
    selectedDate: ref("2026-09-19"),
    week: ref(4),
    seasonType: ref(2),
    selectedGroup: ref("80"),
    isDateLeague: computed(
      () => resolveLeague(selectedLeague.value)?.schedule.mode === "date",
    ),
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

describe("useScoreboard", () => {
  it("uses the existing league URL and applies initial schedule metadata", async () => {
    const selection = createSelection("nfl");
    const replaceNavigation = vi.fn();
    const fetchJson = vi.fn(async () => ({
      events: [{ id: "game-1" }],
      week: { number: 7 },
      season: { type: 3 },
    }));
    const scoreboard = useScoreboard(selection, replaceNavigation, {
      fetchJson,
      isBeforeFootballWeekStart: () => false,
    });

    await scoreboard.fetchScoreboard(true);

    expect(fetchJson).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    );
    expect(scoreboard.games.value).toEqual([{ id: "game-1" }]);
    expect(selection.week.value).toBe(7);
    expect(selection.seasonType.value).toBe(3);
    expect(replaceNavigation).toHaveBeenCalledOnce();
  });

  it("requests the previous football week before the local week starts", async () => {
    const selection = createSelection("college-football");
    const fetchJson = vi.fn()
      .mockResolvedValueOnce({ week: { number: 12 }, season: { type: 2 } })
      .mockResolvedValueOnce({
        events: [{ id: "previous-week" }],
        week: { number: 11 },
        season: { type: 2 },
      });
    const scoreboard = useScoreboard(selection, vi.fn(), {
      fetchJson,
      isBeforeFootballWeekStart: () => true,
    });

    await scoreboard.fetchScoreboard(true);

    expect(fetchJson.mock.calls).toEqual([
      ["https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"],
      ["https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=11&seasontype=2&groups=80"],
    ]);
    expect(scoreboard.games.value).toEqual([{ id: "previous-week" }]);
    expect(selection.week.value).toBe(11);
  });

  it("ignores responses invalidated while a request is pending", async () => {
    const selection = createSelection("nfl");
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchJson = vi.fn(() => new Promise<unknown>((resolve) => {
      resolveFetch = resolve;
    }));
    const scoreboard = useScoreboard(selection, vi.fn(), { fetchJson });
    const pendingRequest = scoreboard.fetchScoreboard();

    scoreboard.invalidateScoreboard();
    resolveFetch({ events: [{ id: "stale-game" }] });
    await pendingRequest;

    expect(scoreboard.games.value).toEqual([]);
  });

  it("hydrates completed games from cache when refresh fails", async () => {
    const selection = createSelection("nba");
    const cachedFinal = { id: "cached-final", status: { type: { state: "post" } } };
    const cache = createCache({
      getScoreboard: vi.fn(async () => [cachedFinal]),
    });
    const fetchJson = vi.fn(async () => { throw new Error("offline"); });
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const scoreboard = useScoreboard(selection, vi.fn(), { fetchJson, cache });

    await scoreboard.fetchScoreboard(true);

    expect(scoreboard.games.value).toEqual([cachedFinal]);
    expect(scoreboard.loading.value).toBe(false);
    expect(scoreboard.lastSuccessfulRefreshAt.value).toBeNull();
    logError.mockRestore();
  });

  it("records successful refreshes and saves the fetched events", async () => {
    const selection = createSelection("nba");
    const events = [{ id: "final-1", status: { type: { state: "post" } } }];
    const cache = createCache();
    const scoreboard = useScoreboard(selection, vi.fn(), {
      cache,
      fetchJson: vi.fn(async () => ({ events })),
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(1234);

    await scoreboard.fetchScoreboard();

    expect(scoreboard.lastSuccessfulRefreshAt.value).toBe(1234);
    expect(cache.saveScoreboard).toHaveBeenCalledWith(
      "nba",
      expect.stringContaining("/nba/scoreboard?dates=20260919"),
      events,
    );
    now.mockRestore();
  });

  it("reports active refreshes and keeps failures visible until the next attempt", async () => {
    const selection = createSelection("nba");
    const fetchJson = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ events: [] });
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const scoreboard = useScoreboard(selection, vi.fn(), {
      fetchJson,
      cache: createCache(),
    });

    const failedRequest = scoreboard.fetchScoreboard();
    expect(scoreboard.refreshing.value).toBe(true);
    await failedRequest;
    expect(scoreboard.refreshing.value).toBe(false);
    expect(scoreboard.refreshFailed.value).toBe(true);

    const retry = scoreboard.fetchScoreboard();
    expect(scoreboard.refreshing.value).toBe(true);
    expect(scoreboard.refreshFailed.value).toBe(false);
    await retry;
    expect(scoreboard.refreshing.value).toBe(false);
    expect(scoreboard.refreshFailed.value).toBe(false);
    logError.mockRestore();
  });
});