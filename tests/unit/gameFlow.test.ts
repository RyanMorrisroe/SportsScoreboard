import { describe, expect, it } from "vitest";
import { buildGameFlow } from "../../src/app/gameFlow";
import type { NormalizedPlayEvent, PlayByPlayTimeline } from "../../src/domain/playByPlay";

function makeEvent(overrides: Partial<NormalizedPlayEvent> = {}): NormalizedPlayEvent {
  return {
    id: "event",
    order: 0,
    sequenceNumber: null,
    periodNumber: null,
    periodLabel: "",
    periodType: "",
    clock: "",
    description: "",
    eventType: "",
    teamId: "",
    teamAbbreviation: "",
    scoring: false,
    awayScore: 0,
    homeScore: 0,
    scoreValue: null,
    downDistance: "",
    fieldPosition: "",
    yardLine: null,
    drive: null,
    isTurnover: false,
    isPenalty: false,
    pitchCount: null,
    outs: null,
    ...overrides,
  };
}

function makeTimeline(events: NormalizedPlayEvent[]): PlayByPlayTimeline {
  return { mode: "all-plays", events };
}

describe("game flow", () => {
  it("plots scoring events and marks the lead", () => {
    const flow = buildGameFlow(makeTimeline([
      makeEvent({ id: "start" }),
      makeEvent({ id: "away-score", awayScore: 7, scoring: true }),
      makeEvent({ id: "home-score", awayScore: 7, homeScore: 7, scoring: true }),
    ]), { away: { id: "away" }, home: { id: "home" } });

    expect(flow.points).toHaveLength(3);
    expect(flow.markers).toMatchObject([
      { event: { id: "away-score" }, lead: "away" },
      { event: { id: "home-score" }, lead: "tie" },
    ]);
    expect(flow.awayPoints).toContain("100,");
    expect(flow.homePoints).toContain("100,");
  });

  it("detects changed score snapshots even when an event is not flagged scoring", () => {
    const flow = buildGameFlow(makeTimeline([
      makeEvent({ id: "one" }),
      makeEvent({ id: "two", homeScore: 2 }),
    ]));
    expect(flow.markers.map(({ event }) => event?.id)).toEqual(["two"]);
  });

  it("keeps scores monotonic and samples dense chart points", () => {
    const events = Array.from({ length: 20 }, (_, index) => makeEvent({
      id: `score-${index}`,
      awayScore: index === 5 ? 3 : index < 5 ? index : index + 2,
      scoring: true,
    }));
    events[5] = makeEvent({ ...events[5], awayScore: 2 });

    const flow = buildGameFlow(makeTimeline(events));

    expect(flow.markers.map((marker) => marker.awayScore)).toEqual(
      [...flow.markers.map((marker) => marker.awayScore)].sort((left, right) => left - right),
    );
    expect(flow.markers).toHaveLength(19);
    expect(flow.chartMarkers).toHaveLength(14);
    expect(flow.points).toHaveLength(15);
  });

  it("returns no chart for missing or invalid scores", () => {
    expect(buildGameFlow(makeTimeline([]))).toMatchObject({
      points: [], awayPoints: "", homePoints: "",
    });
    expect(buildGameFlow(makeTimeline([
      makeEvent({ scoring: true, awayScore: null, homeScore: null }),
    ])).markers).toEqual([]);
  });
});