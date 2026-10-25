import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
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
});