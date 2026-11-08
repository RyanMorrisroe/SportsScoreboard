import { describe, expect, it } from "vitest";
import {
  getTeamRecords,
  getTeamRecordStats,
  normalizeTeamDetails,
  getTeamScheduleSections,
  groupTeamRecordStats,
} from "../../src/domain/team";

describe("team record normalization", () => {
  it("orders current and upcoming games ahead of newest-first results", () => {
    const schedule = [
      { id: "old", state: "post", startTime: 100, result: "L" },
      { id: "next", state: "pre", startTime: 500, result: "" },
      { id: "live", state: "in", startTime: 400, result: "" },
      { id: "recent", state: "post", startTime: 300, result: "W" },
      { id: "tie", state: "post", startTime: 200, result: "T" },
      { id: "older-2", state: "post", startTime: 90, result: "W" },
      { id: "older-3", state: "post", startTime: 80, result: "L" },
      { id: "older-4", state: "post", startTime: 70, result: "T" },
      { id: "older-5", state: "post", startTime: 60, result: "W" },
    ] as Parameters<typeof getTeamScheduleSections>[0];

    expect(getTeamScheduleSections(schedule)).toEqual({
      upcoming: [schedule[2], schedule[1]],
      completed: [
        schedule[3],
        schedule[4],
        schedule[0],
        schedule[5],
        schedule[6],
        schedule[7],
        schedule[8],
      ],
      lastFive: [
        schedule[3],
        schedule[4],
        schedule[0],
        schedule[5],
        schedule[6],
      ],
    });
  });

  it("reads record summaries and formats numeric stats to three decimals", () => {
    const payload = {
      team: {
        record: {
          items: [
            {
              description: "Overall Record",
              summary: "7-1",
              stats: [
                { name: "wins", value: 7 },
                { name: "winPercent", value: 0.875 },
                { name: "average", value: 7.3333333 },
                { name: "displayed", value: 7.3333333, displayValue: "7.3333" },
              ],
            },
          ],
        },
      },
    };

    expect(getTeamRecords(payload)).toEqual([
      { label: "Overall Record", value: "7-1" },
    ]);
    expect(getTeamRecordStats(payload)).toEqual([
      {
        key: "overall-record-wins",
        category: "Overall Record",
        label: "Wins",
        value: 7,
      },
      {
        key: "overall-record-winPercent",
        category: "Overall Record",
        label: "Win Percent",
        value: "87.5%",
      },
      {
        key: "overall-record-average",
        category: "Overall Record",
        label: "Average",
        value: 7.333,
      },
      {
        key: "overall-record-displayed",
        category: "Overall Record",
        label: "Displayed",
        value: "7.3333",
      },
    ]);
    const groups = groupTeamRecordStats([
      ...getTeamRecordStats(payload),
      {
        key: "overall-record-losses",
        category: "Overall Record",
        label: "Losses",
        value: 3,
      },
      {
        key: "home-record-pointsFor",
        category: "Home Record",
        label: "Points For",
        value: 30,
      },
      {
        key: "away-record-passingYards",
        category: "Away Record",
        label: "Passing Yards",
        value: 250,
      },
      {
        key: "overall-record-sacks",
        category: "Overall Record",
        label: "Sacks",
        value: 3,
      },
      {
        key: "overall-record-power-play-opportunities",
        category: "Overall Record",
        label: "Power Play Opportunities",
        value: 76,
      },
    ]);
    expect(groups.map(({ label }) => label)).toEqual([
      "Results",
      "Scoring",
      "Offense",
      "Defense",
      "Special Teams",
      "Other",
    ]);
    expect(groups[0]?.categories[0]).toMatchObject({
      label: "Overall Record",
      stats: [{ label: "Wins" }, { label: "Losses" }, { label: "Win Percent" }],
    });
    expect(groups[1]?.categories[0]?.stats[0]).toMatchObject({
      label: "Points For",
      category: "Home Record",
    });
    expect(groups[2]?.categories[0]?.stats[0]).toMatchObject({
      label: "Passing Yards",
      category: "Away Record",
    });
    expect(groups[4]?.categories[0]?.stats[0]?.label).toBe(
      "Power Play Opportunities",
    );
  });

  it("handles missing and malformed records", () => {
    expect(getTeamRecords({})).toEqual([]);
    expect(getTeamRecordStats({})).toEqual([]);
    expect(
      getTeamRecordStats({
        team: { record: { items: [null, { stats: [null, {}] }] } },
      }),
    ).toEqual([]);
  });

  it("normalizes display fields from unknown team detail payloads", () => {
    expect(
      normalizeTeamDetails({
        team: {
          logos: [{ href: "https://cdn.test/team.png" }, { href: 4 }],
          logo: "https://cdn.test/fallback.png",
          displayName: "Example Team",
          abbreviation: "EXM",
          location: "Example City",
          groups: { name: "Conference" },
        },
        groups: { name: "Division" },
      }),
    ).toEqual({
      team: {
        logos: [{ href: "https://cdn.test/team.png" }, {}],
        logo: "https://cdn.test/fallback.png",
        displayName: "Example Team",
        abbreviation: "EXM",
        location: "Example City",
        groups: { name: "Conference" },
      },
      groups: { name: "Division" },
    });
    expect(normalizeTeamDetails(null)).toBeNull();
  });
});
