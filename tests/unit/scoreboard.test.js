import { describe, expect, it } from "vitest";
import {
  getFavoriteFilterText,
  getGameState,
  getSituation,
  hasPossession,
  getNetwork,
  formatGameTime,
  getCompetitor,
  getTeamName,
  getTeamLogo,
  getTeamScore,
  getTeamRank,
  isWinner,
  isTeamStringHighlighted,
  isGameHighlighted,
  sortGames,
} from "../../src/app/scoreboard.js";

const makeGame = (overrides = {}) => ({
  date: "2026-09-19T18:30:00Z",
  status: { type: { state: "in", detail: "Q2 08:10", shortDetail: "Q2" } },
  competitions: [{
    situation: { downDistanceText: "2nd & 5", possession: "2" },
    broadcasts: [{ names: ["ESPN"] }],
    geoBroadcasts: [{ media: { shortName: "ABC" } }],
    competitors: [
      {
        homeAway: "away",
        id: "1",
        score: 7,
        curatedRank: { current: "12" },
        winner: false,
        team: { displayName: "Away Team", logo: "https://cdn.test/away.png" },
      },
      {
        homeAway: "home",
        id: "2",
        score: 10,
        curatedRank: { current: "5" },
        winner: true,
        team: { displayName: "Home Team", logo: "https://cdn.test/home.png" },
      },
    ],
  }],
  ...overrides,
});

describe("scoreboard helpers", () => {
  it("uses the expected favorite-team fallback for each league", () => {
    expect(getFavoriteFilterText("college-football")).toBe("Northwestern");
    expect(getFavoriteFilterText("nfl")).toBe("Chicago");
  });

  it("reads game state and football situation data", () => {
    const game = makeGame();
    expect(getGameState(game)).toBe("in");
    expect(getSituation(game, "football")).toBe("2nd & 5");
    expect(getSituation({
      status: { type: { state: "in", detail: "Top 9th" } },
      competitions: [{}],
    }, "mlb")).toBe("Top 9th");
    expect(getSituation({
      status: { type: { state: "pre" } },
      competitions: [{}],
    }, "mlb")).toBe("");
  });

  it("reports possession, network, and winner details", () => {
    const game = makeGame();
    expect(hasPossession(game, "home", "football")).toBe(true);
    expect(hasPossession(game, "away", "football")).toBe(false);
    expect(hasPossession(game, "home", "mlb")).toBe(false);
    expect(getNetwork(game)).toBe("ESPN");
    expect(getNetwork({ competitions: [{ geoBroadcasts: [{ media: { shortName: "ABC" } }] }] })).toBe("ABC");
    expect(getNetwork({ competitions: [{}] })).toBe("");
    expect(isWinner(game, "home")).toBe(true);
    expect(isWinner(game, "away")).toBe(false);
  });

  it("formats pre-game times and falls back on invalid data", () => {
    const date = new Date();
    date.setHours(15, 30, 0, 0);

    const game = makeGame({
      date: date.toISOString(),
      status: { type: { state: "pre", shortDetail: "Sat" } },
    });
    expect(formatGameTime(game)).toBe(date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }));

    const futureDate = new Date(Date.now() + 86400000);
    futureDate.setHours(18, 15, 0, 0);
    expect(formatGameTime(makeGame({
      date: futureDate.toISOString(),
      status: { type: { state: "pre", shortDetail: "Sun" } },
    }))).toMatch(/Sun|\d/);

    expect(formatGameTime({
      status: { type: { state: "post", shortDetail: "Final" } },
    })).toBe("Final");
    expect(formatGameTime({
      date: "bad-date",
      status: { type: { state: "pre", shortDetail: "Game time" } },
    })).toBe("Game time");
  });

  it("handles competitor lookups and fallback values", () => {
    const game = makeGame();
    expect(getCompetitor(game, "home").id).toBe("2");
    expect(getTeamName(game, "away")).toBe("Away Team");
    expect(getTeamName({ competitions: [{ competitors: [{ homeAway: "home", team: { location: "St. Louis" } }] }] }, "home")).toBe("St. Louis");
    expect(getTeamLogo(game, "away")).toBe("https://cdn.test/away.png");
    expect(getTeamLogo({ competitions: [{ competitors: [{ homeAway: "home" }] }] }, "home")).toBe("https://a.espncdn.com/i/teamlogos/default-team-logo-500.png");
    expect(getTeamScore(game, "away")).toBe(7);
    expect(getTeamScore({ competitions: [{ competitors: [{ homeAway: "home" }] }] }, "home")).toBe("0");
    expect(getTeamRank(game, "away")).toBe(12);
    expect(getTeamRank({ competitions: [{ competitors: [{ homeAway: "home", curatedRank: { current: "bad" } }] }] }, "home")).toBeNull();
    expect(getTeamName({ competitions: [{ competitors: [{ homeAway: "home" }] }] }, "home")).toBe("Team");
    expect(getTeamLogo({ competitions: [{ competitors: [{ homeAway: "home", team: {} }] }] }, "home")).toBe("https://a.espncdn.com/i/teamlogos/default-team-logo-500.png");
    expect(getNetwork({ competitions: [{ broadcasts: [{ names: [] }], geoBroadcasts: [{ media: {} }] }] })).toBe("");
    expect(hasPossession({ competitions: [{ competitors: [{ homeAway: "home", id: "7" }], situation: { possession: "9" } }] }, "home", "football")).toBe(false);
    expect(getSituation({ competitions: [{ situation: {} }] }, "football")).toBe("");
  });

  it("highlights favorites and sorts games by state and rank", () => {
    const liveGame = makeGame({ id: "live", status: { type: { state: "in", detail: "Q2" } } });
    const earlyPre = makeGame({ id: "pre-early", date: "2026-09-19T17:00:00Z", status: { type: { state: "pre", shortDetail: "Sat" } }, competitions: [{
      situation: { downDistanceText: "1st & 10", possession: "1" },
      competitors: [
        { homeAway: "away", id: "1", score: 0, curatedRank: { current: "20" }, team: { displayName: "Away Team", logo: "away.png" } },
        { homeAway: "home", id: "2", score: 0, curatedRank: { current: "15" }, team: { displayName: "Home Team", logo: "home.png" } },
      ],
    }] });
    const finalGame = makeGame({ id: "final", status: { type: { state: "post", shortDetail: "Final" } }, competitions: [{
      competitors: [
        { homeAway: "away", id: "1", score: 24, winner: true, curatedRank: { current: "9" }, team: { displayName: "Champion", logo: "away.png" } },
        { homeAway: "home", id: "2", score: 17, winner: false, curatedRank: { current: "8" }, team: { displayName: "Runner Up", logo: "home.png" } },
      ],
    }] });

    expect(isTeamStringHighlighted("Northwestern Wildcats", "Northwestern")).toBe(true);
    expect(isGameHighlighted(liveGame, "home")).toBe(true);
    expect(isGameHighlighted(makeGame({ competitions: [{ competitors: [{ homeAway: "away", team: { displayName: "Other" } }, { homeAway: "home", team: { displayName: "Other 2" } }] }] }), "favorite")).toBe(false);
    expect(sortGames([finalGame, liveGame, earlyPre], "nfl").map((g) => g.id)).toEqual(["live", "pre-early", "final"]);
    expect(sortGames([makeGame({ id: "a", date: "2026-09-19T17:00:00Z", status: { type: { state: "pre", detail: "Pre" } } }), makeGame({ id: "b", date: "2026-09-19T18:00:00Z", status: { type: { state: "pre", detail: "Pre 2" } } })], "nfl").map((g) => g.id)).toEqual(["a", "b"]);
  });
});
