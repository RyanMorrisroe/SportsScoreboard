import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useMyTeams } from "../../src/composables/useMyTeams";
import type { FetchJsonOptions } from "../../src/api/espn";
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

function liveSummaryEvent() {
  return {
    id: "event-1",
    header: {
      competitions: [
        {
          status: { type: { state: "in", shortDetail: "2nd Qtr" } },
          competitors: [
            {
              id: "12",
              homeAway: "home",
              score: "24",
              team: { displayName: "Home Team", logos: [{ href: "home.png" }] },
            },
            {
              id: "34",
              homeAway: "away",
              score: "17",
              team: { displayName: "Away Team", logos: [{ href: "away.png" }] },
            },
          ],
        },
      ],
    },
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

  it("ignores a schedule response from before a favorite was removed and re-added", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    let resolveFirst: (payload: unknown) => void = () => {};
    let scheduleCalls = 0;
    const fetchJson = vi.fn((url: string) => {
      if (url.includes("/teams/12/")) {
        scheduleCalls++;
        if (scheduleCalls === 1) {
          return new Promise<unknown>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({ events: [scheduleEvent("new-event")] });
      }
      return Promise.resolve({ events: [] });
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    const firstLoad = teams.load();
    await new Promise((resolve) => setTimeout(resolve, 0));
    preferences.value = toggleFavoriteTeam(preferences.value, "nfl", {
      id: "12",
    });
    preferences.value = addFavorite(
      preferences.value,
      "nfl",
      "12",
      "Home Team",
    );
    const updatedLoad = teams.load();
    resolveFirst({ events: [scheduleEvent("old-event")] });
    await Promise.all([firstLoad, updatedLoad]);

    expect(scheduleCalls).toBe(2);
    expect(teams.games.value.map(({ id }) => id)).toEqual(["new-event"]);
    expect(teams.teamSchedules.value[0]?.loading).toBe(false);
  });

  it("loads one live summary per event and maps scores by home and away", async () => {
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
    const fetchJson = vi.fn(async (url: string) =>
      url.includes("/summary?")
        ? liveSummaryEvent()
        : { events: [scheduleEvent("event-1", "in")] },
    );
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    const game = teams.games.value[0];
    expect(
      fetchJson.mock.calls.filter(([url]) => url.includes("/summary?")),
    ).toHaveLength(1);
    expect(game).toMatchObject({
      state: "in",
      status: "In Progress",
      awayTeam: { name: "Away Team", score: "17" },
      homeTeam: { name: "Home Team", score: "24" },
      favoriteTeams: [{ id: "12" }, { id: "34" }],
    });
  });

  it("uses the final schedule state instead of retained live summary status", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    let scheduleState = "in";
    const finalDate = new Date(NOW - 5 * 60 * 1000).toISOString();
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("/summary?")) return liveSummaryEvent();
      return {
        events: [
          scheduleEvent(
            "event-1",
            scheduleState,
            scheduleState === "post" ? finalDate : undefined,
          ),
        ],
      };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();
    expect(teams.games.value[0]).toMatchObject({
      state: "in",
      status: "In Progress",
      awayTeam: { score: "17" },
    });

    scheduleState = "post";
    await teams.load(true);

    expect(teams.games.value[0]).toMatchObject({
      state: "post",
      status: "Final",
      score: "17-10",
    });
    expect(teams.games.value[0]?.awayTeam).toBeUndefined();
    expect(
      fetchJson.mock.calls.filter(([url]) => url.includes("/summary?")),
    ).toHaveLength(1);
  });

  it("keeps schedule data visible when a live summary request fails", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("/summary?")) throw new Error("Summary unavailable");
      return { events: [scheduleEvent("event-1", "in")] };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(teams.games.value[0]).toMatchObject({
      state: "in",
      status: "In Progress",
      score: "17-10",
    });
    expect(teams.games.value[0]?.awayTeam).toBeUndefined();
  });

  it("records cache provenance when a summary falls back to saved data", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    const cachedAt = NOW - 60_000;
    const fetchJson = vi.fn(
      async (
        url: string,
        _fetchImpl: typeof fetch,
        options: FetchJsonOptions,
      ) => {
        if (url.includes("/summary?")) {
          options.onCacheFallback?.(url, cachedAt);
          return liveSummaryEvent();
        }
        return { events: [scheduleEvent("event-1", "in")] };
      },
    );
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(teams.games.value[0]?.summaryCachedAt).toBe(cachedAt);
    expect(teams.games.value[0]?.awayTeam?.score).toBe("17");
  });

  it("marks retained summary data stale after a failed refresh", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    let summaryCalls = 0;
    let now = NOW;
    const fetchJson = vi.fn(async (url: string) => {
      if (!url.includes("/summary?")) {
        return { events: [scheduleEvent("event-1", "in")] };
      }
      summaryCalls++;
      if (summaryCalls === 2) throw new Error("Summary unavailable");
      return liveSummaryEvent();
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => now });

    await teams.load();
    expect(teams.games.value[0]).toMatchObject({
      summaryLastUpdatedAt: NOW,
      summaryRefreshFailed: false,
    });

    await teams.load(true);

    expect(teams.games.value[0]).toMatchObject({
      awayTeam: { score: "17" },
      summaryLastUpdatedAt: NOW,
      summaryRefreshFailed: true,
      summaryCachedAt: null,
    });

    now += 60_000;
    await teams.load(true);

    expect(teams.games.value[0]).toMatchObject({
      summaryLastUpdatedAt: now,
      summaryRefreshFailed: false,
    });
  });

  it("keeps the previous schedule cache timestamp after a refresh failure", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    const cachedAt = NOW - 60_000;
    let scheduleCalls = 0;
    const fetchJson = vi.fn(
      async (
        url: string,
        _fetchImpl: typeof fetch,
        options: FetchJsonOptions,
      ) => {
        if (url.includes("/summary?")) return liveSummaryEvent();
        scheduleCalls++;
        if (scheduleCalls === 1) {
          options.onCacheFallback?.(url, cachedAt);
          return { events: [scheduleEvent("event-1", "pre")] };
        }
        throw new Error("Schedule unavailable");
      },
    );
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();
    await teams.load(true);

    expect(teams.failedSchedules.value[0]?.cachedAt).toBe(cachedAt);
    expect(teams.games.value.map(({ id }) => id)).toEqual(["event-1"]);
  });

  it("skips the live summary currently owned by the game modal", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    const fetchJson = vi.fn(async (url: string) =>
      url.includes("/summary?")
        ? liveSummaryEvent()
        : { events: [scheduleEvent("event-1", "in")] },
    );
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load(true, "nfl:event-1");

    expect(
      fetchJson.mock.calls.filter(([url]) => url.includes("/summary?")),
    ).toHaveLength(0);
  });

  it("limits concurrent live summary requests", async () => {
    const preferences = ref(createDefaultPreferences());
    for (let id = 1; id <= 6; id++) {
      preferences.value = addFavorite(preferences.value, "nfl", String(id));
    }
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("/summary?")) {
        activeRequests++;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeRequests--;
        return liveSummaryEvent();
      }
      const teamId = url.match(/\/teams\/(\d+)\/schedule/)?.[1];
      return { events: [scheduleEvent(`event-${teamId}`, "in")] };
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    await teams.load();

    expect(maximumActiveRequests).toBe(4);
  });

  it("does not overlap a live summary request across refresh ticks", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    let releaseFirstSummary: () => void = () => {};
    const firstSummary = new Promise<void>((resolve) => {
      releaseFirstSummary = resolve;
    });
    let summaryCalls = 0;
    let activeSummaryRequests = 0;
    let maximumActiveSummaryRequests = 0;
    const fetchJson = vi.fn(async (url: string) => {
      if (!url.includes("/summary?")) {
        return { events: [scheduleEvent("event-1", "in")] };
      }
      summaryCalls++;
      activeSummaryRequests++;
      maximumActiveSummaryRequests = Math.max(
        maximumActiveSummaryRequests,
        activeSummaryRequests,
      );
      if (summaryCalls === 1) await firstSummary;
      activeSummaryRequests--;
      return liveSummaryEvent();
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });
    const initialLoad = teams.load();

    await new Promise((resolve) => setTimeout(resolve, 0));
    const refreshLoad = teams.load(true);
    releaseFirstSummary();
    await Promise.all([initialLoad, refreshLoad]);

    expect(summaryCalls).toBe(2);
    expect(maximumActiveSummaryRequests).toBe(1);
  });

  it("does not queue another forced load while a forced refresh is active", async () => {
    const preferences = ref(
      addFavorite(createDefaultPreferences(), "nfl", "12", "Home Team"),
    );
    let releaseSummary: () => void = () => {};
    const summaryPending = new Promise<void>((resolve) => {
      releaseSummary = resolve;
    });
    let summaryCalls = 0;
    let scheduleCalls = 0;
    const fetchJson = vi.fn(async (url: string) => {
      if (!url.includes("/summary?")) {
        scheduleCalls++;
        return { events: [scheduleEvent("event-1", "in")] };
      }
      summaryCalls++;
      await summaryPending;
      return liveSummaryEvent();
    });
    const teams = useMyTeams(preferences, { fetchJson, now: () => NOW });

    const firstLoad = teams.load(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const refreshLoad = teams.load(true);
    releaseSummary();
    await Promise.all([firstLoad, refreshLoad]);

    expect(scheduleCalls).toBe(1);
    expect(summaryCalls).toBe(1);
  });
});
