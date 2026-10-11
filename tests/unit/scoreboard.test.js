import { describe, expect, it, vi } from "vitest";
import {
  formatGameTime,
  getCompetitor,
  getFavoriteFilterText,
  getGameState,
  getTvLineupDurationMinutes,
  getTvLineupLayout,
  getTvLineupStatus,
  getTvLineupTeamStyle,
  getSeriesSummary,
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
  getTeamStatBarColors,
  getBaseballTeamStatComparisons,
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

  it("summarizes series wins and counts tied games once", () => {
    const competition = makeCompetition({
      series: {
        totalCompetitions: 5,
        competitors: [
          { id: "2", wins: 1, ties: 1 },
          { id: "1", wins: 0, ties: 1 },
        ],
      },
    });

    expect(getSeriesSummary(competition)).toBe("Best of 5 · Home Team lead 1-0 · 1 tied game");
    expect(getSeriesSummary(makeCompetition({
      series: {
        totalCompetitions: 7,
        competitors: [
          { id: "1", wins: 2, ties: 0 },
          { id: "2", wins: 2, ties: 0 },
        ],
      },
    }))).toBe("Best of 7 · Series tied 2-2");
  });

  it("uses completed wording for ended series only", () => {
    const makeSeriesCompetition = (series) => makeCompetition({
      series: {
        totalCompetitions: 3,
        competitors: [
          { id: "2", wins: 2, ties: 0 },
          { id: "1", wins: 1, ties: 0 },
        ],
        ...series,
      },
    });

    expect(getSeriesSummary(makeSeriesCompetition({ type: "playoff", completed: true })))
      .toBe("Best of 3 · Home Team wins series 2-1");
    expect(getSeriesSummary(makeSeriesCompetition({ type: "regular" })))
      .toBe("Best of 3 · Home Team wins series 2-1");
    expect(getSeriesSummary(makeSeriesCompetition({ type: "playoff", completed: false })))
      .toBe("Best of 3 · Home Team lead 2-1");
  });

  it("counts a tied game once when detecting a completed non-playoff series", () => {
    const competition = makeCompetition({
      series: {
        type: "regular",
        totalCompetitions: 4,
        competitors: [
          { id: "2", wins: 2, ties: 1 },
          { id: "1", wins: 1, ties: 1 },
        ],
      },
    });

    expect(getSeriesSummary(competition))
      .toBe("Best of 4 · Home Team wins series 2-1 · 1 tied game");
  });

  it("omits unusable series data", () => {
    expect(getSeriesSummary(makeCompetition())).toBe("");
    expect(getSeriesSummary(makeCompetition({
      series: { competitors: [{ id: "unknown", wins: 1 }, { id: "2", wins: 0 }] },
    }))).toBe("");
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

  it("builds grouped MLB batting, pitching, and fielding comparisons", () => {
    const boxscoreTeams = [
      {
        homeAway: "away",
        statistics: [
          { name: "batting", stats: [
            { name: "hits", displayName: "Hits", displayValue: "7", value: 7 },
            { name: "homeRuns", displayName: "Home Runs", displayValue: "3", value: 3 },
            { name: "avg", displayName: "Batting Average", displayValue: ".212", value: 0.212 },
          ] },
          { name: "pitching", stats: [
            { name: "strikeouts", displayName: "Strikeouts", displayValue: "11", value: 11 },
            { name: "ERA", displayName: "Earned Run Average", displayValue: "5.00", value: 5 },
          ] },
          { name: "fielding", stats: [
            { name: "errors", displayName: "Errors", displayValue: "0", value: 0 },
          ] },
        ],
      },
      {
        homeAway: "home",
        statistics: [
          { name: "batting", stats: [
            { name: "hits", displayName: "Hits", displayValue: "9", value: 9 },
            { name: "homeRuns", displayName: "Home Runs", displayValue: "2", value: 2 },
            { name: "avg", displayName: "Batting Average", displayValue: ".257", value: 0.257 },
          ] },
          { name: "pitching", stats: [
            { name: "strikeouts", displayName: "Strikeouts", displayValue: "6", value: 6 },
            { name: "ERA", displayName: "Earned Run Average", displayValue: "6.00", value: 6 },
          ] },
          { name: "fielding", stats: [
            { name: "errors", displayName: "Errors", displayValue: "1", value: 1 },
          ] },
        ],
      },
    ];

    const batting = getBaseballTeamStatComparisons(boxscoreTeams, "batting");
    const pitching = getBaseballTeamStatComparisons(boxscoreTeams, "pitching");
    const fielding = getBaseballTeamStatComparisons(boxscoreTeams, "fielding");
    expect(batting).toHaveLength(3);
    expect(batting.find((stat) => stat.label === "Hits")).toMatchObject({
      awayDisplay: "7",
      homeDisplay: "9",
      awayPct: 43.75,
      homePct: 56.25,
    });
    expect(pitching).toHaveLength(2);
    expect(pitching.find((stat) => stat.label === "ERA")).toMatchObject({
      awayDisplay: "5.00",
      homeDisplay: "6.00",
    });
    expect(fielding).toHaveLength(1);
    expect(fielding.find((stat) => stat.label === "Errors")).toMatchObject({
      awayPct: 0,
      homePct: 100,
    });
    expect(getBaseballTeamStatComparisons(boxscoreTeams, "invalid")).toEqual([]);
    expect(getBaseballTeamStatComparisons([], "batting")).toEqual([]);
  });

  it("uses valid team colors and keeps dark colors readable on the stat bars", () => {
    expect(getTeamStatBarColors({
      away: { color: "008ca8", alternateColor: "1d1060" },
      home: { color: "231f20", alternateColor: null },
    })).toEqual({
      away: "#008ca8",
      home: "#918f90",
    });
    expect(getTeamStatBarColors({
      away: { color: "231f20", alternateColor: "ffb81c" },
    })).toEqual({
      away: "#ffb81c",
      home: "#059669",
    });
    expect(getTeamStatBarColors({
      away: { color: "231f20", alternateColor: "1d1060" },
    }).away).toBe("#918f90");
    expect(getTeamStatBarColors({
      away: { color: "not-a-color" },
      home: {},
    })).toEqual({
      away: "#2563eb",
      home: "#059669",
    });
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
    expect(formatGameTime(makeGame({
      timeValid: false,
      status: { type: { state: "pre", shortDetail: "Fri 11:00 PM" } },
    }))).toBe("TBD");
    expect(formatGameTime(makeGame({
      competitions: [makeCompetition({ timeValid: false })],
      status: { type: { state: "pre", shortDetail: "Fri 11:00 PM" } },
    }))).toBe("TBD");
    expect(formatGameTime(makeGame({
      status: { type: { state: "pre", shortDetail: "Fri - TBD" } },
    }))).toBe("TBD");
    expect(formatGameTime(makeGame({
      status: { type: { state: "pre", detail: "Game time TBD" } },
    }))).toBe("TBD");

    const timeFormatter = vi.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(() => {
      throw new Error("formatter unavailable");
    });
    expect(formatGameTime(makeGame({
      date: new Date(Date.now() + 86400000).toISOString(),
      status: { type: { state: "pre", shortDetail: "Time unknown" } },
    }))).toBe("Time unknown");
    timeFormatter.mockRestore();
  });

  it("estimates TV lineup durations using the NFL Eastern-time boundary", () => {
    expect(getTvLineupDurationMinutes(makeGame(), "college-football")).toBe(210);
    expect(getTvLineupDurationMinutes(makeGame(), "nba")).toBe(150);
    expect(getTvLineupDurationMinutes(makeGame(), "nhl")).toBe(180);
    expect(getTvLineupDurationMinutes(makeGame(), "mlb")).toBe(180);
    expect(getTvLineupDurationMinutes({ date: "2026-10-10T22:59:00Z" }, "nfl")).toBe(180);
    expect(getTvLineupDurationMinutes({ date: "2026-10-10T23:00:00Z" }, "nfl")).toBe(210);
    expect(getTvLineupDurationMinutes({ date: "2026-01-10T23:59:00Z" }, "nfl")).toBe(180);
    expect(getTvLineupDurationMinutes({ date: "2026-01-10T12:00:00Z" }, "nfl", 3)).toBe(210);
    expect(getTvLineupDurationMinutes({ date: "bad-date" }, "nfl")).toBe(180);
    expect(getTvLineupDurationMinutes({ date: null }, "nfl")).toBe(180);
  });

  it("formats TV lineup status for upcoming, live, and completed games", () => {
    expect(getTvLineupStatus(makeGame({
      date: "bad-date",
      status: { type: { state: "pre", shortDetail: "TBD" } },
    }), "nba")).toBe("TBD");
    expect(getTvLineupStatus(makeGame({
      status: { type: { state: "in", detail: "", shortDetail: "Q2" } },
      competitions: [makeCompetition({ status: { displayClock: "08:10", period: 2 } })],
    }), "nba")).toBe("LIVE · Q2 08:10");
    expect(getTvLineupStatus(makeGame({
      status: { type: { state: "in", detail: "Top 4th", shortDetail: "Top 4th" } },
    }), "mlb")).toBe("LIVE · Top 4th");
    expect(getTvLineupStatus(makeGame({
      status: { type: { state: "in" } },
    }), "nhl")).toBe("LIVE");
    expect(getTvLineupStatus(makeGame({
      status: { type: { state: "post", detail: "Final/OT", shortDetail: "Final/OT" } },
    }), "nhl")).toBe("FINAL");
  });

  it("positions TV lineup games by channel and separates overlapping games", () => {
    const first = makeGame({
      id: "first",
      date: "2026-10-10T16:05:00Z",
      status: { type: { state: "pre", shortDetail: "Sat" } },
    });
    const overlapping = makeGame({
      id: "overlap",
      date: "2026-10-10T16:45:00Z",
      status: { type: { state: "pre", shortDetail: "Sat" } },
    });
    const otherChannel = makeGame({
      id: "other",
      date: "2026-10-10T16:05:00Z",
      status: { type: { state: "pre", shortDetail: "Sat" } },
      competitions: [makeCompetition({ broadcasts: [{ names: ["FOX"] }] })],
    });
    const layout = getTvLineupLayout(
      [first, overlapping, otherChannel],
      "nba",
      2,
      "2026-10-10",
    );
    const espn = layout.channels.find((channel) => channel.name === "ESPN");

    expect(layout.ticks.length).toBeGreaterThan(1);
    expect(layout.timelineWidth).toBe(layout.ticks.length * layout.scale);
    expect(layout.gridlines).toHaveLength(layout.ticks.length + 1);
    expect(layout.gridlines.at(-1).left).toBe(layout.timelineWidth - 1);
    expect(espn.games.map((entry) => entry.game.id)).toEqual(["first", "overlap"]);
    expect(espn.games.map((entry) => entry.lane)).toEqual([0, 1]);
    expect(espn.games[0].left).toBeGreaterThan(0);
    expect(layout.channels.find((channel) => channel.name === "FOX").games[0].lane).toBe(0);
  });

  it("keeps same-day untimed games visible and chooses contrasting team colors", () => {
    const untimedGame = makeGame({
      date: "2026-10-10T16:00:00Z",
      timeValid: false,
      status: { type: { state: "pre", shortDetail: "TBD" } },
    });
    const nextDayUntimedGame = makeGame({
      date: new Date(2026, 9, 11, 1).toISOString(),
      timeValid: false,
      status: { type: { state: "pre", shortDetail: "TBD" } },
    });
    const layout = getTvLineupLayout(
      [untimedGame, nextDayUntimedGame],
      "nba",
      2,
      "2026-10-10",
    );
    const teams = makeGame({
      competitions: [makeCompetition({
        competitors: [
          makeCompetitor("away", { team: { color: "231f20" } }),
          makeCompetitor("home", { team: { color: "ffb81c" } }),
        ],
      })],
    });

    expect(layout.channels).toEqual([]);
    expect(layout.unscheduled.map((entry) => entry.game)).toEqual([untimedGame]);
    expect(getTvLineupTeamStyle(teams, "away")).toEqual({
      backgroundColor: "#231f20",
      color: "#ffffff",
    });
    expect(getTvLineupTeamStyle(teams, "home")).toEqual({
      backgroundColor: "#ffb81c",
      color: "#09090b",
    });
  });

  it("limits the lineup to games starting on the selected local day", () => {
    const todayLate = new Date(2026, 9, 10, 23, 45);
    const tomorrowEarly = new Date(2026, 9, 11, 0, 15);
    const yesterdayLate = new Date(2026, 9, 9, 23, 45);
    const layout = getTvLineupLayout([
      makeGame({ id: "today", date: todayLate.toISOString() }),
      makeGame({ id: "tomorrow", date: tomorrowEarly.toISOString() }),
      makeGame({ id: "yesterday", date: yesterdayLate.toISOString() }),
    ], "nba", 2, "2026-10-10");
    const displayedGames = layout.channels.flatMap((channel) => channel.games);

    expect(displayedGames.map((entry) => entry.game.id)).toEqual(["today"]);
    expect(new Date(layout.ticks.at(-1).timestamp).getDate()).toBe(11);
  });

  it("keeps games that start on the selected day visible after midnight", () => {
    const lateGameDate = new Date(2026, 9, 10, 23, 45);
    const layout = getTvLineupLayout([
      makeGame({ id: "late", date: lateGameDate.toISOString() }),
    ], "nba", 2, "2026-10-10");
    const lateGame = layout.channels[0].games[0];
    const endTimestamp = layout.ticks.at(-1).timestamp;

    expect(lateGame.game.id).toBe("late");
    expect(endTimestamp).toBeGreaterThan(lateGameDate.getTime() + 150 * 60000);
    expect(new Date(endTimestamp).getDate()).toBe(11);
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
