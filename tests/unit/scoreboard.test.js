import { describe, expect, it, vi } from "vitest";
import {
  formatGameTime,
  getCompetitor,
  getFavoriteFilterText,
  getGameState,
  getLinescoreHeaders,
  getLinescoreValues,
  getNetwork,
  getPlayerLeaders,
  getSituation,
  getTeamLogo,
  getTeamName,
  getTeamRank,
  getTeamScore,
  getTeamStatComparisons,
  hasPossession,
  getWinProbabilityChart,
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
    expect(getSituation(makeGame(), "nba")).toBe("Q2 08:10");
    expect(getSituation(makeGame(), "nhl")).toBe("Q2 08:10");
    expect(getSituation({ status: { type: { state: "pre" } }, competitions: [{}] }, "nba")).toBe("");
  });

  it("uses sport-specific linescore periods and overtime labels", () => {
    expect(getLinescoreHeaders("mlb")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(getLinescoreHeaders("nba")).toEqual([1, 2, 3, 4]);
    expect(getLinescoreHeaders("nba", Array(6).fill({}))).toEqual([
      1, 2, 3, 4, "OT", "2OT",
    ]);
    expect(getLinescoreHeaders("nhl")).toEqual([1, 2, 3]);
    expect(getLinescoreHeaders("nhl", [], Array(5).fill({}))).toEqual([
      1, 2, 3, "OT", "2OT",
    ]);
    expect(getLinescoreHeaders("nfl", Array(5).fill({}))).toEqual([
      1, 2, 3, 4, "OT",
    ]);
  });

  it("maps linescores by home/away even when ESPN returns home first", () => {
    expect(getLinescoreValues({
      competitors: [
        { homeAway: "home", linescores: [{ displayValue: "27" }, { displayValue: "30" }] },
        { homeAway: "away", linescores: [{ displayValue: "19" }, { displayValue: "26" }] },
      ],
    }, 3)).toEqual({
      away: ["19", "26", "-"],
      home: ["27", "30", "-"],
    });
    expect(getLinescoreValues({}, 0)).toEqual({ away: [], home: [] });
    expect(getLinescoreValues({
      competitors: [
        { homeAway: "away", linescores: [{ value: 0 }, { value: 2 }, { displayValue: "" }] },
        { homeAway: "home", linescores: [] },
      ],
    }, 3)).toEqual({ away: [0, 2, "0"], home: ["-", "-", "-"] });
  });

  it("normalizes NBA and NHL player leader groups with optional names", () => {
    const nbaPlayers = getPlayerLeaders({
      raw: {
        boxscore: {
          players: [{
            team: { abbreviation: "NY" },
            statistics: [{
              labels: ["PTS", "REB"],
              athletes: [{
                athlete: { displayName: "NBA Player", jersey: "8" },
                stats: ["25", "6"],
              }],
            }],
          }],
        },
      },
    });
    expect(nbaPlayers).toEqual([{
      title: "Player stats",
      labels: ["PTS", "REB"],
      athletes: [{
        name: "NBA Player",
        jersey: "8",
        headshot: "https://a.espncdn.com/i/headshots/placeholder.png",
        teamAbbrev: "NY",
        stats: ["25", "6"],
      }],
    }]);

    expect(getPlayerLeaders({
      raw: {
        boxscore: {
          players: [{
            team: { abbreviation: "BOS" },
            statistics: [
              { name: "forwards", athletes: [{ athlete: { displayName: "Forward" } }] },
              { name: "skaters", athletes: [] },
            ],
          }],
        },
      },
    })[0].title).toBe("Forwards");
    expect(getPlayerLeaders({})).toEqual([]);
    expect(getPlayerLeaders({
      raw: { boxscore: { players: [{ statistics: [{ athletes: [{}] }] }] } },
    })[0].athletes[0]).toMatchObject({
      name: "Player",
      jersey: "-",
      teamAbbrev: "",
      stats: [],
    });
  });

  it("builds a win probability chart for series, singleton, zero, and missing data", () => {
    expect(getWinProbabilityChart([
      { homeWinPercentage: 0.2 },
      { homeWinPercentage: 0.55 },
      { homeWinPercentage: 0.8 },
    ])).toEqual({
      points: "0,20 50,55 100,80",
      singlePoint: null,
    });
    expect(getWinProbabilityChart([{ homeWinPercentage: 0.72 }])).toEqual({
      points: "50,72",
      singlePoint: { x: 50, y: 72 },
    });
    expect(getWinProbabilityChart([
      { homeProbability: 0 },
      { homeWinPercentage: 1 },
    ])).toEqual({ points: "0,0 100,100", singlePoint: null });
    expect(getWinProbabilityChart([{ homeWinPercentage: "invalid" }])).toEqual({
      points: "",
      singlePoint: null,
    });
    expect(getWinProbabilityChart([{}])).toEqual({
      points: "",
      singlePoint: null,
    });
    expect(getWinProbabilityChart([])).toEqual({ points: "", singlePoint: null });
    expect(getWinProbabilityChart(null)).toEqual({ points: "", singlePoint: null });
  });

  it("compares stats from ESPN numeric and displayValue fields", () => {
    const comparisons = getTeamStatComparisons(
      [
        { name: "hits", label: "Hits", displayValue: "20" },
        { name: "fieldGoals", label: "FG", displayValue: "36-90" },
        { name: "assists", label: "Assists", value: 12 },
        { name: "empty", label: "Empty", displayValue: "0" },
      ],
      [
        { name: "hits", label: "Hits", displayValue: "28" },
        { name: "fieldGoals", label: "FG", displayValue: "43-89" },
        { name: "assists", label: "Assists", displayValue: "31" },
        { name: "empty", label: "Empty", displayValue: "0" },
      ],
    );

    expect(comparisons[0]).toMatchObject({
      label: "Hits",
      awayDisplay: "20",
      homeDisplay: "28",
    });
    expect(comparisons[0].awayPct).toBeCloseTo(41.67);
    expect(comparisons[0].homePct).toBeCloseTo(58.33);
    expect(comparisons[1].awayPct).toBeCloseTo(45.57);
    expect(comparisons[1].homePct).toBeCloseTo(54.43);
    expect(comparisons[2].awayPct).toBeCloseTo((12 / 43) * 100);
    expect(comparisons[2].homePct).toBeCloseTo((31 / 43) * 100);
    expect(comparisons[3]).toMatchObject({ awayPct: 50, homePct: 50 });
    expect(getTeamStatComparisons()).toEqual([]);
  });

  it("reports possession, network, and winner details", () => {
    const game = makeGame();

    expect(hasPossession(game, "home", "football")).toBe(true);
    expect(hasPossession(game, "away", "football")).toBe(false);
    expect(hasPossession(game, "home", "mlb")).toBe(false);
    expect(hasPossession(game, "home", "nba")).toBe(false);
    expect(hasPossession(game, "home", "nhl")).toBe(false);
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

    const timeFormatter = vi.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(() => {
      throw new Error("formatter unavailable");
    });
    expect(formatGameTime(makeGame({
      date: new Date(Date.now() + 86400000).toISOString(),
      status: { type: { state: "pre", shortDetail: "Time TBD" } },
    }))).toBe("Time TBD");
    timeFormatter.mockRestore();
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
    const rankedFinals = [
      makeGame({
        id: "rank-20",
        status: { type: { state: "post" } },
        competitions: [{ competitors: [
          makeCompetitor("away", { curatedRank: { current: "99" } }),
          makeCompetitor("home", { curatedRank: { current: "20" } }),
        ] }],
      }),
      makeGame({
        id: "rank-3",
        status: { type: { state: "post" } },
        competitions: [{ competitors: [
          makeCompetitor("away", { curatedRank: { current: "99" } }),
          makeCompetitor("home", { curatedRank: { current: "3" } }),
        ] }],
      }),
    ];
    expect(sortGames(rankedFinals, "nba").map((game) => game.id)).toEqual([
      "rank-3",
      "rank-20",
    ]);
  });
});
