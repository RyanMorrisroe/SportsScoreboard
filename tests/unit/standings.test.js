import { describe, expect, it } from "vitest";
import fixture from "../fixtures/espn/standings.json";
import {
  normalizeStandings,
  sortStandingTeams,
} from "../../src/domain/standings.js";

describe("standings normalization", () => {
  it("normalizes conference and nested division standings with available stat labels", () => {
    expect(normalizeStandings(fixture)).toEqual([
      {
        id: "east",
        name: "Eastern Conference",
        depth: 0,
        columns: [
          { key: "playoffSeed", label: "POS" },
          { key: "wins", label: "W" },
          { key: "losses", label: "L" },
          { key: "winPercent", label: "PCT" },
        ],
        teams: [{
          id: "2",
          name: "Boston Celtics",
          abbreviation: "BOS",
          logo: "celtics.png",
          note: "",
          stats: [
            { key: "playoffSeed", label: "POS", value: "1" },
            { key: "wins", label: "W", value: "52" },
            { key: "losses", label: "L", value: "14" },
            { key: "winPercent", label: "PCT", value: ".788" },
          ],
        }],
      },
      {
        id: "east-atlantic",
        name: "Atlantic Division",
        depth: 1,
        columns: [
          { key: "wins", label: "W" },
          { key: "divisionRecord", label: "Division Record" },
        ],
        teams: [{
          id: "2",
          name: "Boston Celtics",
          abbreviation: "BOS",
          logo: "celtics.png",
          note: "",
          stats: [
            { key: "wins", label: "W", value: 52 },
            { key: "divisionRecord", label: "Division Record", value: "10-2" },
          ],
        }],
      },
      {
        id: "west",
        name: "Western Conference",
        depth: 0,
        columns: [{ key: "wins", label: "Wins" }],
        teams: [{
          id: "9",
          name: "Golden State Warriors",
          abbreviation: "GS",
          logo: "warriors.png",
          note: "",
          stats: [{ key: "wins", label: "Wins", value: 41 }],
        }],
      },
    ]);
  });

  it("handles empty, partial, and root-level standings payloads", () => {
    expect(normalizeStandings(null)).toEqual([]);
    expect(normalizeStandings({ children: [] })).toEqual([]);
    expect(normalizeStandings({ children: [{ name: "Eastern Conference" }] })).toEqual([]);
    expect(normalizeStandings({
      name: "League",
      standings: {
        entries: [{
          team: { displayName: "Team" },
          stats: [
            { name: "wins", value: 0 },
            { name: "missing-value" },
            null,
          ],
        }],
      },
    })).toMatchObject([
      {
        name: "League",
        teams: [{
          name: "Team",
          stats: [{ value: 0 }, { value: "--" }],
        }],
      },
    ]);
  });

  it("orders known stats consistently and keeps unknown stats at the end", () => {
    const result = normalizeStandings({
      standings: {
        entries: [{
          team: { displayName: "Team" },
          stats: [
            { name: "streak", value: "W3" },
            { name: "conferenceRecord", value: "8-2" },
            { name: "pointsAgainst", value: 90 },
            { name: "winPercent", value: 0.8 },
            { name: "losses", value: 2 },
            { name: "playoffSeed", value: 1 },
            { name: "customSecond", value: 2 },
            { name: "wins", value: 8 },
            { name: "pointsFor", value: 100 },
            { name: "gamesBehind", value: 0 },
            { name: "pointDifferential", value: 10 },
            { name: "homeRecord", value: "4-1" },
            { name: "customFirst", value: 1 },
          ],
        }],
      },
    });

    expect(result[0].columns.map((column) => column.key)).toEqual([
      "playoffSeed",
      "wins",
      "losses",
      "winPercent",
      "gamesBehind",
      "pointsFor",
      "pointsAgainst",
      "pointDifferential",
      "homeRecord",
      "conferenceRecord",
      "streak",
      "customSecond",
      "customFirst",
    ]);
  });

  it("sorts numeric stats and split records without mutating the original teams", () => {
    const teams = [
      { name: "Seven wins", stats: [{ key: "record", value: "7-5" }] },
      { name: "Ten wins", stats: [{ key: "record", value: "10-2" }] },
      { name: "No record", stats: [{ key: "record", value: "--" }] },
    ];

    expect(sortStandingTeams(teams, "record", "asc").map((team) => team.name)).toEqual([
      "Seven wins",
      "Ten wins",
      "No record",
    ]);
    expect(sortStandingTeams(teams, "record", "desc").map((team) => team.name)).toEqual([
      "Ten wins",
      "Seven wins",
      "No record",
    ]);
    expect(sortStandingTeams(teams, null, null)).toBe(teams);
    expect(teams.map((team) => team.name)).toEqual(["Seven wins", "Ten wins", "No record"]);
  });
});
