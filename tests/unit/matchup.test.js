import { describe, expect, it } from "vitest";
import fixture from "../fixtures/espn/game-center.json";
import { normalizeMatchup } from "../../src/domain/matchup.js";

describe("pregame matchup normalization", () => {
  it("normalizes teams, overall records, rank, recent form, series, and venue", () => {
    expect(normalizeMatchup(fixture.pregame)).toEqual({
      date: "2026-10-24T23:00:00Z",
      venue: "Example Arena",
      venueLocation: "Example City, EX",
      away: {
        id: "away-1",
        homeAway: "away",
        name: "Away Team",
        abbreviation: "AWY",
        logo: "away.png",
        record: "4-2",
        rank: 8,
        recentGames: [{
          id: "previous-1",
          date: "2026-10-18T20:00:00Z",
          result: "W",
          score: "24-17",
          opponent: "Recent Opponent",
          opponentLogo: "opponent.png",
          atVs: "@",
        }],
      },
      home: {
        id: "home-1",
        homeAway: "home",
        name: "Home Team",
        abbreviation: "HME",
        logo: "home.png",
        record: "3-3",
        rank: null,
        recentGames: [],
      },
      series: {
        title: "Regular Season Series",
        summary: "Series tied 1-1",
        score: "1-1",
        completed: false,
      },
    });
  });

  it("handles absent matchup sections", () => {
    expect(normalizeMatchup(null)).toEqual({
      date: "",
      venue: "",
      venueLocation: "",
      away: null,
      home: null,
      series: null,
    });
  });

  it("omits a kickoff date when ESPN marks the time invalid", () => {
    const event = structuredClone(fixture.pregame);
    event.header.competitions[0].timeValid = false;

    expect(normalizeMatchup(event).date).toBe("");
  });

  it("falls back to the latest completed team schedule games", () => {
    const event = structuredClone(fixture.pregame);
    delete event.lastFiveGames;
    const schedule = {
      events: [
        {
          id: "older-game",
          date: "2026-10-10T20:00:00Z",
          competitions: [{
            status: { type: { state: "post" } },
            competitors: [
              { id: "away-1", homeAway: "away", score: "17", winner: false, team: { displayName: "Away Team" } },
              { id: "old-opponent", homeAway: "home", score: "21", winner: true, team: { displayName: "Older Opponent" } },
            ],
          }],
        },
        {
          id: "newer-game",
          date: "2026-10-18T20:00:00Z",
          competitions: [{
            status: { type: { state: "post" } },
            competitors: [
              { id: "away-1", homeAway: "home", score: "24", winner: true, team: { displayName: "Away Team" } },
              { id: "new-opponent", homeAway: "away", score: "17", winner: false, team: { displayName: "Recent Opponent" } },
            ],
          }],
        },
        {
          id: "future-game",
          date: "2026-10-25T20:00:00Z",
          competitions: [{
            status: { type: { state: "pre" } },
            competitors: [
              { id: "away-1", homeAway: "away", team: { displayName: "Away Team" } },
              { id: "future-opponent", homeAway: "home", team: { displayName: "Future Opponent" } },
            ],
          }],
        },
      ],
    };

    expect(normalizeMatchup(event, { "away-1": schedule }).away.recentGames).toEqual([
      {
        id: "newer-game",
        date: "2026-10-18T20:00:00Z",
        result: "W",
        score: "24-17",
        opponent: "Recent Opponent",
        opponentLogo: "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png",
        atVs: "vs",
      },
      {
        id: "older-game",
        date: "2026-10-10T20:00:00Z",
        result: "L",
        score: "17-21",
        opponent: "Older Opponent",
        opponentLogo: "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png",
        atVs: "@",
      },
    ]);
  });
});