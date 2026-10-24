import { describe, expect, it } from "vitest";
import { buildGameFlow } from "../../src/app/gameFlow.js";

describe("game flow", () => {
  it("plots scoring events and marks the lead", () => {
    const flow = buildGameFlow({
      events: [
        { id: "start", awayScore: 0, homeScore: 0, scoring: false },
        { id: "away-score", awayScore: 7, homeScore: 0, scoring: true },
        { id: "home-score", awayScore: 7, homeScore: 7, scoring: true },
      ],
    }, { away: { id: "away" }, home: { id: "home" } });

    expect(flow.points).toHaveLength(3);
    expect(flow.markers).toMatchObject([
      { event: { id: "away-score" }, lead: "away" },
      { event: { id: "home-score" }, lead: "tie" },
    ]);
    expect(flow.awayPoints).toContain("100,");
    expect(flow.homePoints).toContain("100,");
  });

  it("detects changed score snapshots even when an event is not flagged scoring", () => {
    const flow = buildGameFlow({
      events: [
        { id: "one", awayScore: 0, homeScore: 0, scoring: false },
        { id: "two", awayScore: 0, homeScore: 2, scoring: false },
      ],
    });
    expect(flow.markers.map(({ event }) => event.id)).toEqual(["two"]);
  });

  it("keeps scores monotonic and samples dense chart points", () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      id: `score-${index}`,
      awayScore: index === 5 ? 3 : index < 5 ? index : index + 2,
      homeScore: 0,
      scoring: true,
    }));
    events[5].awayScore = 2;

    const flow = buildGameFlow({ events });

    expect(flow.markers.map((marker) => marker.awayScore)).toEqual(
      [...flow.markers.map((marker) => marker.awayScore)].sort((left, right) => left - right),
    );
    expect(flow.markers).toHaveLength(19);
    expect(flow.chartMarkers).toHaveLength(14);
    expect(flow.points).toHaveLength(15);
  });

  it("returns no chart for missing or invalid scores", () => {
    expect(buildGameFlow({ events: [] })).toMatchObject({ points: [], awayPoints: "", homePoints: "" });
    expect(buildGameFlow({ events: [{ scoring: true, awayScore: null, homeScore: null }] }).markers).toEqual([]);
  });
});