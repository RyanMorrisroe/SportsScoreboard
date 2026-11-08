import { describe, expect, it } from "vitest";
import { getCurrentDriveSummary } from "../../src/domain/drive";

describe("getCurrentDriveSummary", () => {
  it("reports possession, field position, down, and only the latest play", () => {
    const summary = getCurrentDriveSummary(
      {
        current: {
          description: "4 plays, 28 yards",
          displayResult: "In progress",
          team: { id: "home-1", abbreviation: "HME" },
          plays: [
            { text: "First play" },
            {
              text: "Run for 6 yards",
              end: {
                possessionText: "AWY 42",
                downDistanceText: "2nd & 4",
              },
            },
          ],
          recap: { recap: "The drive continues." },
        },
      },
      {
        away: { id: "away-1", name: "Away Team", abbrev: "AWY" },
        home: { id: "home-1", name: "Home Team", abbrev: "HME" },
      },
    );

    expect(summary).toEqual({
      description: "4 plays, 28 yards",
      result: "In progress",
      possessionTeam: "Home Team",
      fieldPosition: "AWY 42",
      downDistance: "2nd & 4",
      lastPlay: "Run for 6 yards",
      recap: "The drive continues.",
    });
  });

  it("returns null when the response has no current drive", () => {
    expect(getCurrentDriveSummary({ current: null })).toBeNull();
  });
});
