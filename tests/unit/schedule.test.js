import { describe, expect, it } from "vitest";
import { normalizeSchedule } from "../../src/domain/schedule.js";

const logo = (id) => `https://cdn.test/${id}.png`;

const event = (overrides = {}) => ({
  id: "game-1",
  date: "2026-09-19T23:30:00Z",
  week: { text: "Week 3" },
  competitions: [{
    timeValid: true,
    venue: { fullName: "Test Stadium" },
    status: { type: { state: "post", shortDetail: "Final" } },
    competitors: [
      { id: "12", homeAway: "home", winner: true, score: "34", team: { displayName: "Home Team", logos: [{ href: logo("home") }] } },
      { id: "34", homeAway: "away", winner: false, score: "18", team: { displayName: "Away Team", logos: [{ href: logo("away") }] } },
    ],
  }],
  ...overrides,
});

describe("schedule normalization", () => {
  it("maps home games with logos, score, result, and venue", () => {
    expect(normalizeSchedule({ events: [event()] }, "12", "UTC")[0]).toMatchObject({
      date: "Sep 19, 2026, 11:30 PM",
      opponent: "Away Team",
      opponentLogo: logo("away"),
      teamLogo: logo("home"),
      homeAway: "home",
      score: "34-18",
      result: "W",
      status: "Final",
      venue: "Test Stadium",
    });
  });

  it("maps away games and supports score objects", () => {
    const awayEvent = event({
      competitions: [{
        timeValid: true,
        competitors: [
          { id: "12", homeAway: "away", winner: false, score: { displayValue: "18" }, team: { displayName: "Selected" } },
          { id: "34", homeAway: "home", winner: true, score: { value: 34 }, team: { displayName: "Opponent" } },
        ],
        status: { type: { state: "post", shortDetail: "Final" } },
      }],
    });
    expect(normalizeSchedule({ events: [awayEvent] }, "12", "UTC")[0]).toMatchObject({
      opponent: "Opponent",
      homeAway: "away",
      score: "18-34",
      result: "L",
    });
  });

  it("suppresses placeholder times for TBD events", () => {
    const tbdEvent = event({
      timeValid: false,
      competitions: [{
        timeValid: false,
        status: { type: { state: "pre", shortDetail: "TBD" } },
        competitors: event().competitions[0].competitors,
      }],
    });
    expect(normalizeSchedule({ events: [tbdEvent] }, "12", "UTC")[0]).toMatchObject({
      date: "TBD",
      status: "TBD",
    });
  });
});
