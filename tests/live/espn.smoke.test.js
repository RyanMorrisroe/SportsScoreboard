import { describe, expect, it } from "vitest";
import { fetchTeamDetails } from "../../src/api/espn.js";
import { normalizeSchedule } from "../../src/domain/schedule.js";

const league = process.env.ESPN_LEAGUE || "nfl";
const teamId = process.env.ESPN_TEAM_ID || "12";

describe("live ESPN smoke checks", () => {
  it("returns a usable team details and schedule contract", async () => {
    const response = await fetchTeamDetails(league, teamId);
    const team = response.details?.team;

    expect(team).toBeDefined();
    expect(team.id === undefined || String(team.id) === String(teamId)).toBe(true);
    expect(Array.isArray(response.schedule?.events)).toBe(true);

    const normalized = normalizeSchedule(response.schedule, teamId, "UTC");
    for (const event of normalized) {
      expect(event.id).toBeTruthy();
      expect(event.date || event.status).toBeTruthy();
      expect(event.opponent).toBeTruthy();
      expect(["home", "away", undefined]).toContain(event.homeAway);
      expect(typeof event.score).toBe("string");
      expect(typeof event.result).toBe("string");
    }
  }, 30_000);
});
