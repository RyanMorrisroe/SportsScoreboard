import { describe, expect, it } from "vitest";
import fixture from "../fixtures/espn/game-center.json";
import { normalizePlayByPlay } from "../../src/domain/playByPlay.js";

describe("play-by-play normalization", () => {
  it("flattens football drives in source order and avoids duplicate scoring entries", () => {
    const timeline = normalizePlayByPlay(fixture.football, "nfl");

    expect(timeline.mode).toBe("all-plays");
    expect(timeline.events.map((event) => event.id)).toEqual([
      "football-play-1",
      "football-play-2",
      "football-play-3",
    ]);
    expect(timeline.events[0]).toMatchObject({
      downDistance: "2nd & 5",
      fieldPosition: "AWY 35",
      yardLine: 35,
      drive: { id: "drive-1", teamId: "away-1" },
    });
    expect(timeline.events[1]).toMatchObject({ scoring: true, awayScore: 7 });
  });

  it.each([
    ["mlb", fixture.baseball, "Top of 1st Inning", "Top"],
    ["nba", fixture.basketball, "1st Quarter", "", "home-1", 0],
    ["nhl", fixture.hockey, "1st Period", "", "away-1", 1],
  ])("normalizes %s period, clock, and scoring events", (league, raw, periodLabel, periodType, teamId = "away-1", awayScore = 1) => {
    const timeline = normalizePlayByPlay(raw, league);

    expect(timeline.mode).toBe("all-plays");
    expect(timeline.events[0].periodLabel).toBe(periodLabel);
    expect(timeline.events[0].periodType).toBe(periodType);
    expect(timeline.events[1]).toMatchObject({
      scoring: true,
      teamId,
      awayScore,
    });
  });

  it("uses a scoring-only fallback when full plays are not present", () => {
    expect(normalizePlayByPlay({ scoringPlays: fixture.football.scoringPlays }, "nfl")).toMatchObject({
      mode: "scoring-only",
      events: [{ id: "football-play-2", scoring: true, awayScore: 7 }],
    });
  });

  it("orders plays by sequence number when the feed is reversed", () => {
    const timeline = normalizePlayByPlay({
      plays: [
        { id: "later", sequenceNumber: "20", period: { number: 1 }, clock: { displayValue: "08:00" }, awayScore: 2, homeScore: 0 },
        { id: "earlier", sequenceNumber: "10", period: { number: 1 }, clock: { displayValue: "11:00" }, awayScore: 0, homeScore: 0 },
      ],
    }, "nba");

    expect(timeline.events.map((event) => event.id)).toEqual(["earlier", "later"]);
  });

  it("returns an explicit unavailable state and tolerates malformed input", () => {
    expect(normalizePlayByPlay(null, "nba")).toEqual({ mode: "unavailable", events: [] });
    expect(normalizePlayByPlay({ plays: [null, {}] }, "nba").events[1]).toMatchObject({
      id: "event-1",
      description: "Play details unavailable.",
      awayScore: null,
      homeScore: null,
    });
  });
});