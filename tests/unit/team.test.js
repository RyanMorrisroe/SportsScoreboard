import { describe, expect, it } from "vitest";
import { getTeamRecords, getTeamRecordStats } from "../../src/domain/team.js";

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

  it("handles missing records", () => {
    expect(getTeamRecords({})).toEqual([]);
    expect(getTeamRecordStats({})).toEqual([]);
  });
});
