import { describe, expect, it } from "vitest";
import {
  formatGameTime,
  getCompetitor,
  getFavoriteFilterText,
  getGameState,
  getNetwork,
  getSituation,
  getTeamLogo,
  getTeamName,
  getTeamRank,
  getTeamScore,
  hasPossession,
  isGameHighlighted,
  isTeamStringHighlighted,
  isWinner,
  sortGames,
} from "../../src/app/scoreboard.js";

const makeCompetitor = (homeAway, overrides = {}) => ({
  homeAway,
  id: homeAway === "away" ? "1" : "2",
  score: homeAway === "away" ? 7 : 10,
  curatedRank: { current: homeAway === "away" ? "12" : "5" },
  winner: homeAway === "home",
  team: {
    displayName: homeAway === "away" ? "Away Team" : "Home Team",
    logo: `https://cdn.test/${homeAway}.png`,
  },
  ...overrides,
});

const makeCompetition = (overrides = {}) => ({
  situation: { downDistanceText: "2nd & 5", possession: "2" },
  broadcasts: [{ names: ["ESPN"] }],
  geoBroadcasts: [{ media: { shortName: "ABC" } }],
  competitors: [
    makeCompetitor("away"),
    makeCompetitor("home"),
  ],
  ...overrides,
});

const makeGame = (overrides = {}) => ({
  date: "2026-09-19T18:30:00Z",
  status: { type: { state: "in", detail: "Q2 08:10", shortDetail: "Q2" } },
  competitions: [makeCompetition()],
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
    expect(getSituation({ status: { type: { state: "in", detail: "Top 9th" } }, competitions: [{}] }, "mlb")).toBe("Top 9th");
    expect(getSituation({ status: { type: { state: "pre" } }, competitions: [{}] }, "mlb")).toBe("");
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
    const today = new Date();
    today.setHours(15, 30, 0, 0);

    const game = makeGame({
      date: today.toISOString(),
      status: { type: { state: "pre", shortDetail: "Sat" } },
    });
    expect(formatGameTime(game)).toBe(today.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));

    const futureDate = new Date(Date.now() + 86400000);
    futureDate.setHours(18, 15, 0, 0);
    expect(formatGameTime(makeGame({
      date: futureDate.toISOString(),
      status: { type: { state: "pre", shortDetail: "Sun" } },
    }))).toMatch(/Sun|\d/);

    expect(formatGameTime({ status: { type: { state: "post", shortDetail: "Final" } } })).toBe("Final");
    expect(formatGameTime({ date: "bad-date", status: { type: { state: "pre", shortDetail: "Game time" } } })).toBe("Game time");
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
    expect(getGameState({})).toBe("");
    expect(getFavoriteFilterText("mlb")).toBe("Chicago");
  });

  it("covers remaining sort and pregame branches", () => {
    const preA = makeGame({
      id: "pre-a",
      date: "2026-09-19T16:00:00Z",
      status: { type: { state: "pre", detail: "Upcoming" } },
      competitions: [{
        situation: { downDistanceText: "1st & 10", possession: "1" },
        competitors: [
          makeCompetitor("away", { id: "1", score: 0, curatedRank: { current: "20" }, team: { displayName: "Away", logo: "away.png" } }),
          makeCompetitor("home", { id: "2", score: 0, curatedRank: { current: "15" }, team: { displayName: "Home", logo: "home.png" } }),
        ],
      }],
    });
    const preB = makeGame({
      id: "pre-b",
      date: "2026-09-19T17:00:00Z",
      status: { type: { state: "pre", detail: "Upcoming 2" } },
      competitions: [{
        situation: { downDistanceText: "3rd & 7", possession: "2" },
        competitors: [
          makeCompetitor("away", { id: "1", score: 0, curatedRank: { current: "12" }, team: { displayName: "Away", logo: "away.png" } }),
          makeCompetitor("home", { id: "2", score: 0, curatedRank: { current: "11" }, team: { displayName: "Home", logo: "home.png" } }),
        ],
      }],
    });

    expect(sortGames([preB, preA], "football").map((game) => game.id)).toEqual(["pre-a", "pre-b"]);
    expect(getSituation({ status: { type: { state: "in", detail: "Top 9th" } }, competitions: [{ situation: { downDistanceText: "2nd & 5" } }] }, "mlb")).toBe("Top 9th");
    expect(formatGameTime({ status: { type: { state: "pre", shortDetail: "Preview" } }, date: null })).toBe("Preview");
  });

  it("highlights favorites and sorts games by state and rank", () => {
    const liveGame = makeGame({ id: "live", status: { type: { state: "in", detail: "Q2" } } });
    const earlyPre = makeGame({
      id: "pre-early",
      date: "2026-09-19T17:00:00Z",
      status: { type: { state: "pre", shortDetail: "Sat" } },
      competitions: [{
        situation: { downDistanceText: "1st & 10", possession: "1" },
        competitors: [
          makeCompetitor("away", { id: "1", score: 0, curatedRank: { current: "20" }, team: { displayName: "Away Team", logo: "away.png" } }),
          makeCompetitor("home", { id: "2", score: 0, curatedRank: { current: "15" }, team: { displayName: "Home Team", logo: "home.png" } }),
        ],
      }],
    });
    const finalGame = makeGame({
      id: "final",
      status: { type: { state: "post", shortDetail: "Final" } },
      competitions: [{
        competitors: [
          makeCompetitor("away", { id: "1", score: 24, winner: true, curatedRank: { current: "9" }, team: { displayName: "Champion", logo: "away.png" } }),
          makeCompetitor("home", { id: "2", score: 17, winner: false, curatedRank: { current: "8" }, team: { displayName: "Runner Up", logo: "home.png" } }),
        ],
      }],
    });

    expect(isTeamStringHighlighted("Northwestern Wildcats", "Northwestern")).toBe(true);
    expect(isGameHighlighted(liveGame, "home")).toBe(true);
    expect(isGameHighlighted(makeGame({ competitions: [{ competitors: [{ homeAway: "away", team: { displayName: "Other" } }, { homeAway: "home", team: { displayName: "Other 2" } }] }] }), "favorite")).toBe(false);
    expect(sortGames([finalGame, liveGame, earlyPre], "nfl").map((game) => game.id)).toEqual(["live", "pre-early", "final"]);
    expect(sortGames([
      makeGame({ id: "a", date: "2026-09-19T17:00:00Z", status: { type: { state: "pre", detail: "Pre" } } }),
      makeGame({ id: "b", date: "2026-09-19T18:00:00Z", status: { type: { state: "pre", detail: "Pre 2" } } }),
    ], "nfl").map((game) => game.id)).toEqual(["a", "b"]);
  });
});
