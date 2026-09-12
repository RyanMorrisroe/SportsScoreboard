import { describe, expect, it, vi } from "vitest";
import details from "../fixtures/espn/nfl-team-details.json";
import schedule from "../fixtures/espn/nfl-team-schedule.json";
import { fetchTeamDetails } from "../../src/api/espn.js";
import { normalizeSchedule } from "../../src/domain/schedule.js";
import { getTeamRecordStats, getTeamRecords } from "../../src/domain/team.js";

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(body),
});

describe("ESPN fixture contracts", () => {
  it("normalizes representative team details and schedule payloads", async () => {
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
      { key: "total-losses", label: "Losses", value: 2 },
      { key: "total-winPercent", label: "Win Percent", value: "83.3%" },
    ]);

    const normalized = normalizeSchedule(response.schedule, "12", "UTC");
    expect(normalized[0]).toMatchObject({
      id: "fixture-final",
      date: "Sep 19, 2026, 6:30 PM",
      week: "Week 3",
      opponent: "Away Fixture Team",
      homeAway: "home",
      score: "31-17",
      result: "W",
      status: "Final",
      venue: "Arrowhead Stadium",
    });
    expect(normalized[0].opponentLogo).toContain("fixture-away.png");
    expect(normalized[0].teamLogo).toContain("/kc.png");
    expect(normalized[1]).toMatchObject({
      id: "fixture-tbd",
      date: "TBD",
      week: "Week 5",
      opponent: "TBD Opponent",
      homeAway: "home",
      score: "--",
      result: "",
      status: "TBD",
    });
  });
});
