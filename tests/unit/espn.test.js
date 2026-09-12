import { describe, expect, it, vi } from "vitest";
import {
  fetchJson,
  fetchTeamDetails,
  getLeagueBaseUrl,
  getTeamUrls,
  getSportPath,
} from "../../src/api/espn.js";

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

  it("rejects non-OK responses", async () => {
    await expect(fetchJson("https://example.test", vi.fn().mockResolvedValue(jsonResponse({}, false, 503))))
      .rejects.toThrow("ESPN request failed (503)");
  });
});
