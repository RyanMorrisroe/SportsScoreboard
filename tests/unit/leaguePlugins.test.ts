import { describe, expect, it } from "vitest";
import { getLeague, LEAGUES } from "../../src/app/leagues";
import {
  composeLeagueBehavior,
  LEAGUE_IDS,
  resolveLeague,
} from "../../src/plugins/registry";

describe("league plugin registry", () => {
  it("preserves the existing league order and display labels", () => {
    expect(LEAGUE_IDS).toEqual([
      "college-football",
      "nfl",
      "mlb",
      "nba",
      "nhl",
    ]);
    expect(LEAGUES).toEqual([
      { id: "college-football", label: "CFB", name: "College Football" },
      { id: "nfl", label: "NFL", name: "NFL" },
      { id: "mlb", label: "MLB", name: "MLB" },
      { id: "nba", label: "NBA", name: "NBA" },
      { id: "nhl", label: "NHL", name: "NHL" },
    ]);
  });

  it("composes shared, sport-family, and league behavior in precedence order", () => {
    expect(resolveLeague("nfl")).toMatchObject({
      family: "football",
      sportPath: "football",
      schedule: {
        mode: "week",
        includesSeasonType: true,
        supportsGroupFilter: false,
      },
      linescore: {
        regulationPeriods: 4,
        kind: "period",
        situation: "football",
        supportsPossession: true,
      },
    });
    expect(resolveLeague("college-football")?.schedule.supportsGroupFilter).toBe(true);
    expect(composeLeagueBehavior("football", {
      schedule: { mode: "date", supportsGroupFilter: true },
      linescore: { regulationPeriods: 5 },
    })).toMatchObject({
      schedule: { mode: "date", includesSeasonType: true, supportsGroupFilter: true },
      linescore: { regulationPeriods: 5, situation: "football" },
    });
  });

  it("uses shared date behavior and sport-family linescore defaults", () => {
    expect(resolveLeague("mlb")).toMatchObject({
      schedule: { mode: "date", includesSeasonType: false },
      linescore: { regulationPeriods: 9, kind: "inning", situation: "baseball" },
    });
    expect(resolveLeague("nba")?.linescore.regulationPeriods).toBe(4);
    expect(resolveLeague("nhl")?.linescore.regulationPeriods).toBe(3);
  });

  it("composes TV lineup defaults and league-specific timing policies", () => {
    expect(resolveLeague("college-football")?.tvLineup.duration).toEqual({
      mode: "fixed",
      minutes: 210,
    });
    expect(resolveLeague("nfl")?.tvLineup.duration).toEqual({
      mode: "football",
      regularMinutes: 180,
      extendedMinutes: 210,
      postseasonType: 3,
      timezone: "America/New_York",
      eveningKickoffHour: 19,
    });
    expect(resolveLeague("mlb")?.tvLineup.status).toBe("inning");
    expect(resolveLeague("nba")?.tvLineup.duration).toEqual({
      mode: "fixed",
      minutes: 150,
    });
    expect(resolveLeague("nhl")?.tvLineup.duration).toEqual({
      mode: "fixed",
      minutes: 180,
    });
  });

  it("returns the resolved plugin through the existing league lookup API", () => {
    expect(getLeague("nfl")).toMatchObject({ id: "nfl", label: "NFL" });
    expect(getLeague("unsupported")).toBeNull();
    expect(resolveLeague("toString")).toBeNull();
  });
});