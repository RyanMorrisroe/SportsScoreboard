import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  fetchJson,
  fetchStandings,
  fetchTeamDetails,
  getGameSummaryUrl,
  getLeagueBaseUrl,
  getScoreboardRequestParams,
  getScoreboardUrl,
  getTeamUrls,
  getStandingsUrl,
  getSportPath,
} from "../../src/api/espn.js";
import {
  createGameCache,
  type GameCacheRecord,
  type GameCacheStorage,
} from "../../src/app/gameCache";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}));

afterEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(isTauri).mockReturnValue(false);
});

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
});

function makeCache() {
  const records = new Map<string, GameCacheRecord>();
  const storage: GameCacheStorage = {
    get: vi.fn(async (key) => records.get(key) ?? null),
    put: vi.fn(async (record) => {
      records.set(record.key, record);
    }),
    delete: vi.fn(async (key) => {
      records.delete(key);
    }),
  };
  return createGameCache(storage);
}

describe("ESPN API helpers", () => {
  it.each([
    ["college-football", "football"],
    ["nfl", "football"],
    ["mlb", "baseball"],
    ["nba", "basketball"],
    ["nhl", "hockey"],
  ])("maps %s to %s", (league, sport) => {
    expect(getSportPath(league)).toBe(sport);
  });

  it("builds team and schedule URLs", () => {
    expect(getLeagueBaseUrl("mlb")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb",
    );
    expect(getTeamUrls("nfl", "12")).toEqual({
      details:
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12",
      schedule:
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12/schedule",
    });
  });

  it.each([
    ["college-football", "football"],
    ["nfl", "football"],
    ["mlb", "baseball"],
    ["nba", "basketball"],
    ["nhl", "hockey"],
  ])("builds the v2 standings URL for %s", (league, sport) => {
    expect(getStandingsUrl(league)).toBe(
      `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`,
    );
  });

  it("adds an ESPN group identifier to standings requests", () => {
    expect(getStandingsUrl("nfl", { group: "8" })).toBe(
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?group=8",
    );
  });

  it.each([
    ["nba", "basketball", "nba"],
    ["nhl", "hockey", "nhl"],
  ])("builds scoreboard and summary URLs for %s", (league, sport, slug) => {
    const base = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}`;

    expect(getScoreboardUrl(league)).toBe(`${base}/scoreboard`);
    expect(getScoreboardUrl(league, { dates: "20261003" })).toBe(
      `${base}/scoreboard?dates=20261003`,
    );
    expect(getGameSummaryUrl(league, "event 123")).toBe(
      `${base}/summary?event=event%20123`,
    );
    expect(getTeamUrls(league, "13")).toEqual({
      details: `${base}/teams/13`,
      schedule: `${base}/teams/13/schedule`,
    });
  });

  it("preserves the football fallback for unrecognized leagues", () => {
    expect(getSportPath("other-league")).toBe("football");
  });

  it("omits empty scoreboard parameters", () => {
    expect(getScoreboardUrl("college-football", { groups: "", week: 3 })).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=3",
    );
  });

  it.each(["mlb", "nba", "nhl"])("uses calendar dates for %s", (league) => {
    expect(getScoreboardRequestParams(league, { date: "2025-03-20" })).toEqual({
      dates: "20250320",
    });
    expect(getScoreboardRequestParams(league, { date: "" })).toEqual({});
  });

  it("keeps football week controls and college group filters", () => {
    expect(
      getScoreboardRequestParams("college-football", {
        initial: true,
        group: "80",
      }),
    ).toEqual({ groups: "80" });
    expect(
      getScoreboardRequestParams("college-football", {
        week: 3,
        seasonType: 2,
        group: "80",
      }),
    ).toEqual({ week: 3, seasontype: 2, groups: "80" });
    expect(getScoreboardRequestParams("nfl", { initial: true })).toEqual({});
    expect(
      getScoreboardRequestParams("nfl", { week: 3, seasonType: 3 }),
    ).toEqual({
      week: 3,
      seasontype: 3,
    });
  });

  it("fetches team details and schedule with an injected client", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ team: { id: "12" } }))
      .mockResolvedValueOnce(jsonResponse({ events: [] }));

    await expect(fetchTeamDetails("nfl", "12", fetchImpl)).resolves.toEqual({
      details: { team: { id: "12" } },
      schedule: { events: [] },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/teams/12"),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/teams/12/schedule"),
    );
  });

  it("falls back to cached team and schedule responses independently", async () => {
    const cache = makeCache();
    const urls = getTeamUrls("nfl", "12");
    const details = { team: { id: "12" } };
    const schedule = { events: [{ id: "game-1" }] };
    await cache.saveResponse(urls.details, details);
    await cache.saveResponse(urls.schedule, schedule);
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const onCacheFallback = vi.fn();

    await expect(
      fetchTeamDetails("nfl", "12", fetchImpl, {
        cache,
        onCacheFallback,
      }),
    ).resolves.toEqual({ details, schedule });

    expect(onCacheFallback).toHaveBeenCalledWith(
      urls.details,
      expect.any(Number),
    );
    expect(onCacheFallback).toHaveBeenCalledWith(
      urls.schedule,
      expect.any(Number),
    );
  });

  it("uses direct fetches outside Tauri", async () => {
    const payload = { events: [] };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const url = getScoreboardUrl("nfl");

    await expect(fetchJson(url, fetchImpl)).resolves.toEqual(payload);

    expect(fetchImpl).toHaveBeenCalledWith(url);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("persists successful responses and serves them after a network failure", async () => {
    const cache = makeCache();
    const payload = { events: [{ id: "scheduled-1" }] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(payload))
      .mockRejectedValueOnce(new Error("offline"));
    const onCacheFallback = vi.fn();
    const url = getScoreboardUrl("nba", { dates: "20261031" });

    await expect(fetchJson(url, fetchImpl, { cache })).resolves.toEqual(
      payload,
    );
    await expect(
      fetchJson(url, fetchImpl, { cache, onCacheFallback }),
    ).resolves.toEqual(payload);

    expect(onCacheFallback).toHaveBeenCalledWith(url, expect.any(Number));
  });

  it("uses the native ESPN command inside Tauri", async () => {
    const payload = { team: { id: "12" } };
    const fetchImpl = vi.fn();
    const url = getTeamUrls("nfl", "12").details;
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue(payload);

    await expect(fetchJson(url, fetchImpl)).resolves.toEqual(payload);

    expect(invoke).toHaveBeenCalledWith("fetch_espn", { url });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves cached responses after native Tauri requests fail", async () => {
    const cache = makeCache();
    const url = getTeamUrls("nfl", "12").details;
    const payload = { team: { id: "12" } };
    await cache.saveResponse(url, payload);
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockRejectedValue(new Error("offline"));
    const onCacheFallback = vi.fn();

    await expect(
      fetchJson(url, vi.fn(), { cache, onCacheFallback }),
    ).resolves.toEqual(payload);

    expect(onCacheFallback).toHaveBeenCalledWith(url, expect.any(Number));
  });

  it("keeps the newest successful response when same-URL requests finish out of order", async () => {
    const cache = makeCache();
    const url = getScoreboardUrl("nba");
    const olderPayload = { marker: "older" };
    const newerPayload = { marker: "newer" };
    let resolveOlder!: (value: ReturnType<typeof jsonResponse>) => void;
    let resolveNewer!: (value: ReturnType<typeof jsonResponse>) => void;
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
            resolveNewer = resolve;
          }),
      );

    const olderRequest = fetchJson(url, fetchImpl, { cache });
    const newerRequest = fetchJson(url, fetchImpl, { cache });
    resolveNewer(jsonResponse(newerPayload));
    await newerRequest;
    resolveOlder(jsonResponse(olderPayload));
    await olderRequest;

    expect((await cache.getResponse(url))?.value).toEqual(newerPayload);
  });

  it.each([
    ["a string rejection", "ESPN unavailable", "ESPN unavailable"],
    ["an error rejection", new Error("ESPN unavailable"), "ESPN unavailable"],
    ["an unstructured rejection", {}, "ESPN request failed"],
  ])(
    "normalizes %s from the native command",
    async (_label, error, message) => {
      vi.mocked(isTauri).mockReturnValue(true);
      vi.mocked(invoke).mockRejectedValue(error);

      await expect(fetchJson(getScoreboardUrl("nfl"))).rejects.toThrow(message);
    },
  );

  it("fetches standings from the v2 Site API", async () => {
    const body = {
      children: [
        {
          id: "8",
          name: "American Football Conference",
          standings: { entries: [{ team: { id: "1" } }] },
        },
      ],
    };
    const subgroups = {
      children: [{ id: "4", name: "AFC East", standings: { entries: [] } }],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(subgroups));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual({
      children: [
        {
          ...body.children[0],
          children: subgroups.children,
        },
      ],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings",
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?group=8",
    );
  });

  it("reports cached standings and subgroup responses as local fallbacks", async () => {
    const cache = makeCache();
    const url = getStandingsUrl("nfl");
    const subgroupUrl = getStandingsUrl("nfl", { group: "8" });
    const standings = { children: [{ id: "8", name: "AFC" }] };
    const subgroup = { children: [{ id: "4", name: "AFC East" }] };
    await cache.saveResponse(url, standings);
    await cache.saveResponse(subgroupUrl, subgroup);
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const onCacheFallback = vi.fn();

    await expect(
      fetchStandings("nfl", fetchImpl, { cache, onCacheFallback }),
    ).resolves.toEqual({
      children: [{ ...standings.children[0], children: subgroup.children }],
    });

    expect(onCacheFallback).toHaveBeenCalledWith(url, expect.any(Number));
    expect(onCacheFallback).toHaveBeenCalledWith(
      subgroupUrl,
      expect.any(Number),
    );
  });

  it.each([
    ["missing children", {}],
    ["empty children", { children: [] }],
  ])("returns standings unchanged when %s", async (_label, standings) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(standings));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual(standings);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps standings groups without IDs or with existing children", async () => {
    const standings = {
      children: [{ name: "No ID" }, { id: "8", children: [{ id: "4" }] }],
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(standings));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual(standings);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a standings group when its subgroup response is empty", async () => {
    const group = { id: "8", name: "AFC" };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ children: [group] }))
      .mockResolvedValueOnce(jsonResponse({ children: [] }));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual({
      children: [group],
    });
  });

  it("rejects non-OK responses", async () => {
    await expect(
      fetchJson(
        "https://example.test",
        vi.fn().mockResolvedValue(jsonResponse({}, false, 503)),
      ),
    ).rejects.toThrow("ESPN request failed (503)");
  });
});
