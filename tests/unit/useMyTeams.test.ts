import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useMyTeams } from "../../src/composables/useMyTeams";
import {
  createDefaultPreferences,
  toggleFavoriteTeam,
  type Preferences,
} from "../../src/app/preferences";

const NOW = Date.parse("2026-10-31T12:00:00Z");

function addFavorite(
  preferences: Preferences,
  league: string,
  id: string,
  name = `Team ${id}`,
): Preferences {
  return toggleFavoriteTeam(preferences, league, {
    id,
    name,
    abbreviation: id,
    logo: `${id}.png`,
  });
}

function scheduleEvent(
  id: string,
  state = "pre",
  date = new Date(NOW + 60 * 60 * 1000).toISOString(),
) {
  return {
    id,
    date,
    competitions: [
      {
        status: {
          type: {
            state,
            shortDetail:
              state === "in"
                ? "In Progress"
                : state === "post"
                  ? "Final"
                  : "Scheduled",
          },
        },
        competitors: [
          {
            id: "12",
            homeAway: "home",
            score: "17",
            winner: state === "post",
            team: { displayName: "Team 12" },
          },
          {
            id: "34",
            homeAway: "away",
            score: "10",
            winner: false,
            team: { displayName: "Team 34" },
          },
        ],
      },
    ],
  };
}

describe("useMyTeams", () => {
  it("loads favorite schedules across leagues and deduplicates favorite matchups", async () => {
    const preferences = ref(createDefaultPreferences());
    preferences.value = addFavorite(
      preferences.value,
      "nfl",
      "12",
      "Home Team",
    );
    preferences.value = addFavorite(
      preferences.value,
      "nfl",
      "34",
      "Away Team",
    );
    preferences.value = addFavorite(
      preferences.value,
      "nba",
      "12",
      "Basketball Team",
    );
    const fetchJson = vi.fn(async (_url: string) => {
      return { events: [scheduleEvent("event-1", "pre")] };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(fetchJson).toHaveBeenCalledTimes(3);
    expect(
      fetchJson.mock.calls.every(([url]) => url.endsWith("/schedule")),
    ).toBe(true);
    expect(teams.games.value).toHaveLength(2);
    const nflGame = teams.games.value.find((game) => game.league === "nfl");
    const nbaGame = teams.games.value.find((game) => game.league === "nba");
    expect(nflGame?.favoriteTeams.map((team) => team.id)).toEqual(["12", "34"]);
    expect(nbaGame?.favoriteTeams.map((team) => team.id)).toEqual(["12"]);
  });

  it("shows the most recent final from the prior seven days with its result", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12"),
    );
    const fetchJson = vi.fn(async () => ({
      events: [
        scheduleEvent(
          "older-final",
          "post",
          new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
        ),
        scheduleEvent(
          "last-final",
          "post",
          new Date(NOW - 5 * 60 * 1000).toISOString(),
        ),
        scheduleEvent(
          "upcoming",
          "pre",
          new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
        ),
      ],
    }));
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(teams.games.value.map(({ id }) => id)).toEqual([
      "last-final",
      "upcoming",
    ]);
    expect(teams.games.value[0]).toMatchObject({
      state: "post",
      result: "W",
      score: "17-10",
    });
  });

  it("retains successful schedules when another favorite fails and reuses results until refresh", async () => {
    const preferences = ref(createDefaultPreferences());
    preferences.value = addFavorite(preferences.value, "nfl", "12");
    preferences.value = addFavorite(preferences.value, "nfl", "34");
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("/teams/34/")) throw new Error("Schedule unavailable");
      return { events: [scheduleEvent("event-1")] };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();
    expect(teams.games.value).toHaveLength(1);
    expect(teams.failedSchedules.value.map(({ team }) => team.id)).toEqual([
      "34",
    ]);

    await teams.load();
    expect(fetchJson).toHaveBeenCalledTimes(2);
    await teams.load(true);
    expect(fetchJson).toHaveBeenCalledTimes(4);
  });

  it("limits concurrent schedule requests", async () => {
    const preferences = ref(createDefaultPreferences());
    for (let id = 1; id <= 6; id++) {
      preferences.value = addFavorite(preferences.value, "nfl", String(id));
    }
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const fetchJson = vi.fn(async () => {
      activeRequests++;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeRequests--;
      return { events: [] };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(fetchJson).toHaveBeenCalledTimes(6);
    expect(maximumActiveRequests).toBe(4);
  });

  it("reconciles favorite changes that happen during a schedule load", async () => {
    const preferences = ref(createDefaultPreferences());
    preferences.value = addFavorite(preferences.value, "nfl", "12");
    let resolveFirst: (payload: unknown) => void = () => {};
    const fetchJson = vi.fn((url: string) => {
      if (url.includes("/teams/12/")) {
        return new Promise<unknown>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ events: [scheduleEvent("new-event")] });
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    const firstLoad = teams.load();
    preferences.value = toggleFavoriteTeam(preferences.value, "nfl", {
      id: "12",
    });
    preferences.value = addFavorite(preferences.value, "nfl", "34");
    const updatedLoad = teams.load();
    resolveFirst({ events: [scheduleEvent("old-event")] });
    await Promise.all([firstLoad, updatedLoad]);

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(teams.teamSchedules.value.map(({ team }) => team.id)).toEqual([
      "34",
    ]);
    expect(teams.games.value.map(({ id }) => id)).toEqual(["new-event"]);
  });
});
