import { describe, expect, it } from "vitest";
import {
  filterMyTeamsScheduleEntries,
  normalizeSchedule,
} from "../../src/domain/schedule";

type TestEvent = {
  id: string;
  date: string;
  week: { text: string };
  timeValid?: boolean;
  competitions: Array<{
    timeValid?: boolean;
    venue?: { fullName?: string };
    status?: {
      type?: { state?: string; shortDetail?: string; description?: string };
    };
    competitors: Array<{
      id: string;
      homeAway: string;
      winner?: boolean;
      score?: string | { displayValue?: string; value?: number };
      team?: {
        displayName?: string;
        logo?: string;
        logos?: Array<{ href: string }>;
      };
    }>;
  }>;
};

const logo = (id: string) => `https://cdn.test/${id}.png`;

const event = (overrides: Partial<TestEvent> = {}): TestEvent => ({
  id: "game-1",
  date: "2026-09-19T23:30:00Z",
  week: { text: "Week 3" },
  competitions: [
    {
      timeValid: true,
      venue: { fullName: "Test Stadium" },
      status: { type: { state: "post", shortDetail: "Final" } },
      competitors: [
        {
          id: "12",
          homeAway: "home",
          winner: true,
          score: "34",
          team: { displayName: "Home Team", logos: [{ href: logo("home") }] },
        },
        {
          id: "34",
          homeAway: "away",
          winner: false,
          score: "18",
          team: { displayName: "Away Team", logos: [{ href: logo("away") }] },
        },
      ],
    },
  ],
  ...overrides,
});

describe("schedule normalization", () => {
  it("maps home games with logos, score, result, and venue", () => {
    expect(
      normalizeSchedule({ events: [event()] }, "12", "UTC")[0],
    ).toMatchObject({
      date: "Sep 19, 2026, 11:30 PM",
      opponent: "Away Team",
      opponentLogo: logo("away"),
      teamLogo: logo("home"),
      homeAway: "home",
      score: "34-18",
      result: "W",
      startTime: Date.parse("2026-09-19T23:30:00Z"),
      state: "post",
      status: "Final",
      venue: "Test Stadium",
    });
  });

  it("maps away games and supports score objects", () => {
    const awayEvent = event({
      competitions: [
        {
          timeValid: true,
          competitors: [
            {
              id: "12",
              homeAway: "away",
              winner: false,
              score: { displayValue: "18" },
              team: { displayName: "Selected" },
            },
            {
              id: "34",
              homeAway: "home",
              winner: true,
              score: { value: 34 },
              team: { displayName: "Opponent" },
            },
          ],
          status: { type: { state: "post", shortDetail: "Final" } },
        },
      ],
    });
    expect(
      normalizeSchedule({ events: [awayEvent] }, "12", "UTC")[0],
    ).toMatchObject({
      opponent: "Opponent",
      homeAway: "away",
      score: "18-34",
      result: "L",
    });
  });

  it("suppresses placeholder times for TBD events", () => {
    const tbdEvent = event({
      timeValid: false,
      competitions: [
        {
          timeValid: false,
          status: { type: { state: "pre", shortDetail: "TBD" } },
          competitors: event().competitions[0].competitors,
        },
      ],
    });
    expect(
      normalizeSchedule({ events: [tbdEvent] }, "12", "UTC")[0],
    ).toMatchObject({
      date: "TBD",
      startTime: null,
      status: "TBD",
    });
  });

  it("keeps live and upcoming games and the latest recent final", () => {
    const now = Date.parse("2026-09-19T23:30:00Z");
    const day = 24 * 60 * 60 * 1000;
    const entries = [
      { id: "now", state: "pre", startTime: now },
      { id: "week", state: "pre", startTime: now + 7 * day },
      { id: "late", state: "pre", startTime: now + 7 * day + 1 },
      { id: "last-final", state: "post", startTime: now - 5 * 60 * 1000 },
      { id: "older-final", state: "post", startTime: now - 2 * day },
      { id: "expired-final", state: "post", startTime: now - 7 * day - 1 },
      { id: "unknown-time", state: "pre", startTime: null },
    ];

    expect(
      filterMyTeamsScheduleEntries(entries, now).map(({ id }) => id),
    ).toEqual(["now", "week", "last-final"]);
  });

  it("hides a recent final after a later game has started", () => {
    const now = Date.parse("2026-09-19T23:30:00Z");
    const entries = [
      {
        id: "recent-final",
        state: "post",
        startTime: now - 2 * 60 * 60 * 1000,
      },
      { id: "later-live", state: "in", startTime: now - 30 * 60 * 1000 },
    ];

    expect(
      filterMyTeamsScheduleEntries(entries, now).map(({ id }) => id),
    ).toEqual(["later-live"]);
  });
});
