import { describe, expect, it } from "vitest";
import {
  getTeamRecords,
  getTeamRecordStats,
  normalizeTeamDetails,
} from "../../src/domain/team";

describe("team record normalization", () => {
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

    expect(getTeamRecords(payload)).toEqual([{ label: "Overall Record", value: "7-1" }]);
    expect(getTeamRecordStats(payload)).toEqual([
      { key: "record-wins", label: "Wins", value: 7 },
      { key: "record-winPercent", label: "Win Percent", value: 0.875 },
      { key: "record-average", label: "Average", value: 7.333 },
      { key: "record-displayed", label: "Displayed", value: "7.3333" },
    ]);
  });

  it("handles missing and malformed records", () => {
    expect(getTeamRecords({})).toEqual([]);
    expect(getTeamRecordStats({})).toEqual([]);
    expect(getTeamRecordStats({ team: { record: { items: [null, { stats: [null, {}] }] } } })).toEqual([]);
  });

  it("normalizes display fields from unknown team detail payloads", () => {
    expect(normalizeTeamDetails({
      team: {
        logos: [{ href: "https://cdn.test/team.png" }, { href: 4 }],
        logo: "https://cdn.test/fallback.png",
        displayName: "Example Team",
        abbreviation: "EXM",
        location: "Example City",
        groups: { name: "Conference" },
      },
      groups: { name: "Division" },
    })).toEqual({
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