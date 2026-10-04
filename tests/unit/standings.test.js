import { describe, expect, it } from "vitest";
import fixture from "../fixtures/espn/standings.json";
import { normalizeStandings } from "../../src/domain/standings.js";

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
});
