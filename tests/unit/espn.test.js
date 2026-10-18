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

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}));

afterEach(() => {
  invoke.mockReset();
  isTauri.mockReturnValue(false);
});

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
});

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
      details: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12",
      schedule: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12/schedule",
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
    expect(getScoreboardRequestParams("college-football", {
      initial: true,
      group: "80",
    })).toEqual({ groups: "80" });
    expect(getScoreboardRequestParams("college-football", {
      week: 3,
      seasonType: 2,
      group: "80",
    })).toEqual({ week: 3, seasontype: 2, groups: "80" });
    expect(getScoreboardRequestParams("nfl", { initial: true })).toEqual({});
    expect(getScoreboardRequestParams("nfl", { week: 3, seasonType: 3 })).toEqual({
      week: 3,
      seasontype: 3,
    });
  });

  it("fetches team details and schedule with an injected client", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ team: { id: "12" } }))
      .mockResolvedValueOnce(jsonResponse({ events: [] }));

    await expect(fetchTeamDetails("nfl", "12", fetchImpl)).resolves.toEqual({
      details: { team: { id: "12" } },
      schedule: { events: [] },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, expect.stringContaining("/teams/12"));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, expect.stringContaining("/teams/12/schedule"));
  });

  it("uses direct fetches outside Tauri", async () => {
    const payload = { events: [] };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const url = getScoreboardUrl("nfl");

    await expect(fetchJson(url, fetchImpl)).resolves.toEqual(payload);

    expect(fetchImpl).toHaveBeenCalledWith(url);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses the native ESPN command inside Tauri", async () => {
    const payload = { team: { id: "12" } };
    const fetchImpl = vi.fn();
    const url = getTeamUrls("nfl", "12").details;
    isTauri.mockReturnValue(true);
    invoke.mockResolvedValue(payload);

    await expect(fetchJson(url, fetchImpl)).resolves.toEqual(payload);

    expect(invoke).toHaveBeenCalledWith("fetch_espn", { url });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["a string rejection", "ESPN unavailable", "ESPN unavailable"],
    ["an error rejection", new Error("ESPN unavailable"), "ESPN unavailable"],
    ["an unstructured rejection", {}, "ESPN request failed"],
  ])("normalizes %s from the native command", async (_label, error, message) => {
    isTauri.mockReturnValue(true);
    invoke.mockRejectedValue(error);

    await expect(fetchJson(getScoreboardUrl("nfl"))).rejects.toThrow(message);
  });

  it("fetches standings from the v2 Site API", async () => {
    const body = {
      children: [{
        id: "8",
        name: "American Football Conference",
        standings: { entries: [{ team: { id: "1" } }] },
      }],
    };
    const subgroups = {
      children: [{ id: "4", name: "AFC East", standings: { entries: [] } }],
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(subgroups));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual({
      children: [{
        ...body.children[0],
        children: subgroups.children,
      }],
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
      children: [
        { name: "No ID" },
        { id: "8", children: [{ id: "4" }] },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(standings));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual(standings);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a standings group when its subgroup response is empty", async () => {
    const group = { id: "8", name: "AFC" };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ children: [group] }))
      .mockResolvedValueOnce(jsonResponse({ children: [] }));

    await expect(fetchStandings("nfl", fetchImpl)).resolves.toEqual({
      children: [group],
    });
  });

  it("rejects non-OK responses", async () => {
    await expect(fetchJson("https://example.test", vi.fn().mockResolvedValue(jsonResponse({}, false, 503))))
      .rejects.toThrow("ESPN request failed (503)");
  });
});
