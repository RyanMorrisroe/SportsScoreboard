import { describe, expect, it, vi } from "vitest";
import { fetchTeamDetails } from "../../src/api/espn.js";
import { normalizeSchedule } from "../../src/domain/schedule.js";
import { getTeamRecordStats, getTeamRecords } from "../../src/domain/team.js";

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(body),
});

describe("team details integration", () => {
  it("fetches and normalizes team details, records, stats, and schedule", async () => {
    const details = {
      team: {
        id: "12",
        record: {
          items: [{
            type: "total",
            description: "Overall",
            summary: "10-2",
            stats: [
              { name: "wins", value: 10 },
              { name: "winPercent", displayValue: "83.3%" },
            ],
          }],
        },
      },
    };
    const schedule = {
      events: [{
        id: "event-1",
        date: "2026-09-19T18:30:00Z",
        week: { text: "Week 3" },
        competitions: [{
          status: { type: { state: "post", shortDetail: "Final" } },
          venue: { fullName: "Memorial Stadium" },
          competitors: [
            {
              id: "12",
              homeAway: "home",
              score: { displayValue: "31" },
              winner: true,
              team: { displayName: "Home Team", logo: "home.png" },
            },
            {
              id: "34",
              homeAway: "away",
              score: { displayValue: "17" },
              winner: false,
              team: { displayName: "Away Team", logo: "away.png" },
            },
          ],
        }],
      }],
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(details))
      .mockResolvedValueOnce(jsonResponse(schedule));

    const response = await fetchTeamDetails("nfl", "12", fetchImpl);

    expect(response).toEqual({ details, schedule });
    expect(getTeamRecords(response.details)).toEqual([
      { label: "Overall", value: "10-2" },
    ]);
    expect(getTeamRecordStats(response.details)).toEqual([
      { key: "total-wins", label: "Wins", value: 10 },
      { key: "total-winPercent", label: "Win Percent", value: "83.3%" },
    ]);
    expect(normalizeSchedule(response.schedule, "12", "UTC")).toEqual([{
      id: "event-1",
      date: "Sep 19, 2026, 6:30 PM",
      week: "Week 3",
      opponent: "Away Team",
      opponentLogo: "away.png",
      teamLogo: "home.png",
      homeAway: "home",
      score: "31-17",
      result: "W",
      status: "Final",
      venue: "Memorial Stadium",
    }]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12",
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12/schedule",
    );
  });
});