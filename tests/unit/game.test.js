import { describe, expect, it } from "vitest";
import { buildGameDetail } from "../../src/domain/game.js";

describe("game detail normalization", () => {
  it("merges header and boxscore data for away and home teams", () => {
    const payload = {
      id: "evt-9",
      header: {
        competitions: [{
          competitors: [
            {
              id: "11",
              homeAway: "away",
              score: 7,
              rank: 18,
              team: {
                displayName: "Away Team",
                abbreviation: "AWY",
                logos: [{ href: "https://cdn.test/away-header.png" }],
              },
            },
            {
              id: "22",
              homeAway: "home",
              score: 10,
              rank: 5,
              team: {
                displayName: "Home Team",
                abbreviation: "HME",
                logos: [{ href: "https://cdn.test/home-header.png" }],
              },
            },
          ],
        }],
      },
      boxscore: {
        teams: [
          {
            homeAway: "away",
            team: { id: "11", displayName: "Away Team", logo: "https://cdn.test/away-box.png" },
            statistics: [{ name: "yards", displayValue: "320" }],
          },
          {
            homeAway: "home",
            team: { id: "22", displayName: "Home Team", logo: "https://cdn.test/home-box.png" },
            statistics: [{ name: "yards", displayValue: "410" }],
          },
        ],
      },
      scoringPlays: [{ id: "sp-1" }],
      drives: { current: { description: "Drive result" } },
      winprobability: [{ homeWinPercentage: 0.66 }],
    };

    expect(buildGameDetail(payload)).toEqual({
      id: "evt-9",
      raw: payload,
      teams: {
        away: {
          id: "11",
          abbrev: "AWY",
          name: "Away Team",
          rank: 18,
          logo: "https://cdn.test/away-header.png",
          score: 7,
          statistics: [{ name: "yards", displayValue: "320" }],
        },
        home: {
          id: "22",
          abbrev: "HME",
          name: "Home Team",
          rank: 5,
          logo: "https://cdn.test/home-header.png",
          score: 10,
          statistics: [{ name: "yards", displayValue: "410" }],
        },
      },
      scoringPlays: [{ id: "sp-1" }],
      drives: { current: { description: "Drive result" } },
      winprobability: [{ homeWinPercentage: 0.66 }],
    });
  });

  it("uses fallback values when header data is missing", () => {
    const payload = {
      boxscore: {
        teams: [
          {
            homeAway: "away",
            team: { id: "44", logo: "https://cdn.test/away-box.png" },
            statistics: [{ name: "rush", value: 80 }],
          },
          {
            homeAway: "home",
            team: { id: "55", logo: "https://cdn.test/home-box.png" },
            statistics: [{ name: "rush", value: 90 }],
          },
        ],
      },
    };

    expect(buildGameDetail(payload, "evt-fallback")).toMatchObject({
      id: "evt-fallback",
      teams: {
        away: { id: "44", abbrev: "AWAY", name: "Away Team", logo: "https://cdn.test/away-box.png", score: "0" },
        home: { id: "55", abbrev: "HOME", name: "Home Team", logo: "https://cdn.test/home-box.png", score: "0" },
      },
    });
  });
});
