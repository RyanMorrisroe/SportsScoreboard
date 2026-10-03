import { describe, expect, it, vi } from "vitest";
import details from "../fixtures/espn/nfl-team-details.json";
import schedule from "../fixtures/espn/nfl-team-schedule.json";
import nba from "../fixtures/espn/nba.json";
import nhl from "../fixtures/espn/nhl.json";
import mlbBoxscoreStats from "../fixtures/espn/mlb-boxscore-stats.json";
import { fetchTeamDetails, getTeamUrls } from "../../src/api/espn.js";
import {
  getLinescoreHeaders,
  getLinescoreValues,
  getPlayerLeaders,
  getTeamName,
  getTeamScore,
  getTeamStatComparisons,
  getBaseballTeamStatComparisons,
  hasPossession,
  getWinProbabilityChart,
} from "../../src/app/scoreboard.js";
import { buildGameDetail } from "../../src/domain/game.js";
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

  it.each([
    ["nba", nba, {
      away: "New York Knicks",
      awayScore: "98",
      homeScore: "115",
      headers: [1, 2, 3, 4],
      awayLines: ["19", "25", "28", "26"],
      homeLines: ["27", "27", "31", "30"],
      leadersTitle: "Player stats",
      firstStatAwayPct: (36 / (36 + 43)) * 100,
      recordLabel: "Overall Record",
      record: "0-0",
      schedule: {
        opponent: "Sacramento Kings",
        homeAway: "away",
        score: "--",
        result: "",
        status: "Scheduled",
        venue: "Golden 1 Center",
      },
    }],
    ["nhl", nhl, {
      away: "New Jersey Devils",
      awayScore: "5",
      homeScore: "4",
      headers: [1, 2, 3, "OT"],
      awayLines: ["1", "3", "0", "1"],
      homeLines: ["1", "2", "1", "0"],
      leadersTitle: "Forwards",
      firstStatAwayPct: (8 / (8 + 14)) * 100,
      recordLabel: "Overall Record",
      record: "0-0-1",
      schedule: {
        opponent: "Boston Bruins",
        homeAway: "home",
        score: "3-4",
        result: "L",
        status: "Final/OT",
        venue: "Canada Life Centre",
      },
    }],
  ])("normalizes %s scoreboard, summary, and team payloads", async (league, fixture, expected) => {
    const event = fixture.scoreboard.events[0];
    const detail = buildGameDetail(fixture.summary, fixture.summary.id);
    const competition = fixture.summary.header.competitions[0];
    const awayLines = competition.competitors.find((team) => team.homeAway === "away").linescores;
    const homeLines = competition.competitors.find((team) => team.homeAway === "home").linescores;

    expect(getTeamName(event, "away")).toBe(expected.away);
    expect(getTeamScore(event, "away")).toBe(expected.awayScore);
    expect(detail.teams.away.name).toBe(expected.away);
    expect(detail.teams.away.score).toBe(expected.awayScore);
    expect(detail.teams.home.score).toBe(expected.homeScore);
    const statComparisons = getTeamStatComparisons(
      detail.teams.away.statistics,
      detail.teams.home.statistics,
    );
    expect(statComparisons[0].awayPct).toBeCloseTo(expected.firstStatAwayPct);
    expect(statComparisons[0].homePct).toBeCloseTo(100 - expected.firstStatAwayPct);
    expect(getLinescoreHeaders(league, awayLines, homeLines)).toEqual(expected.headers);
    expect(getLinescoreValues(competition, expected.headers.length)).toEqual({
      away: expected.awayLines,
      home: expected.homeLines,
    });
    expect(hasPossession(event, "home", league)).toBe(false);
    expect(getWinProbabilityChart(detail.winprobability)).toEqual(
      league === "nba"
        ? { points: "50,72", singlePoint: { x: 50, y: 72 } }
        : { points: "", singlePoint: null },
    );
    expect(getPlayerLeaders(detail)[0]).toMatchObject({
      title: expected.leadersTitle,
      athletes: expect.arrayContaining([
        expect.objectContaining({ name: expect.any(String), teamAbbrev: expect.any(String) }),
      ]),
    });
    expect(getTeamRecords(fixture.teamDetails)).toEqual([
      { label: expected.recordLabel, value: expected.record },
    ]);
    expect(getTeamRecordStats(fixture.teamDetails).length).toBeGreaterThan(0);

    const normalizedSchedule = normalizeSchedule(fixture.teamSchedule, fixture.teamId, "UTC");
    expect(normalizedSchedule).toHaveLength(1);
    expect(normalizedSchedule[0]).toMatchObject(expected.schedule);

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(fixture.teamDetails))
      .mockResolvedValueOnce(jsonResponse(fixture.teamSchedule));
    await expect(fetchTeamDetails(league, fixture.teamId, fetchImpl)).resolves.toEqual({
      details: fixture.teamDetails,
      schedule: fixture.teamSchedule,
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, getTeamUrls(league, fixture.teamId).details);
    expect(fetchImpl).toHaveBeenNthCalledWith(2, getTeamUrls(league, fixture.teamId).schedule);
  });

  it("exposes batting, pitching, and fielding stats from an MLB boxscore", () => {
    const batting = getBaseballTeamStatComparisons(mlbBoxscoreStats.teams, "batting");
    const pitching = getBaseballTeamStatComparisons(mlbBoxscoreStats.teams, "pitching");
    const fielding = getBaseballTeamStatComparisons(mlbBoxscoreStats.teams, "fielding");

    expect(batting).toHaveLength(13);
    expect(batting.find((stat) => stat.label === "Hits")).toMatchObject({
      awayDisplay: "7",
      homeDisplay: "9",
      awayPct: 43.75,
      homePct: 56.25,
    });
    expect(pitching).toHaveLength(10);
    expect(pitching.find((stat) => stat.label === "ERA")).toMatchObject({
      awayDisplay: "5.00",
      homeDisplay: "6.00",
    });
    expect(fielding).toHaveLength(5);
    expect(fielding.find((stat) => stat.label === "Errors")).toMatchObject({
      awayDisplay: "0",
      homeDisplay: "0",
      awayPct: 0,
      homePct: 0,
    });
  });
});
