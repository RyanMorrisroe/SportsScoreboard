import { describe, expect, it, vi } from "vitest";
import {
  canGoBackWithinApp,
  initializeAppHistory,
  pushAppHistoryEntry,
  readAppHistoryEntry,
  replaceAppHistoryEntry,
} from "../../src/app/navigation.js";

const makeSnapshot = (overrides = {}) => ({
  league: "nfl",
  view: "scoreboard",
  week: 4,
  seasonType: 2,
  selectedGroup: "",
  selectedDate: "2026-10-10",
  modal: null,
  ...overrides,
});

function makeHistory(state = { host: "preserved" }) {
  return {
    state,
    pushState: vi.fn(function (nextState) {
      this.state = nextState;
    }),
    replaceState: vi.fn(function (nextState) {
      this.state = nextState;
    }),
  };
}

describe("navigation history helpers", () => {
  it("initializes a root entry while preserving host state and the URL", () => {
    const history = makeHistory({ host: "preserved" });
    const entry = initializeAppHistory(history, makeSnapshot());

    expect(entry.index).toBe(0);
    expect(entry.rootIndex).toBe(0);
    expect(canGoBackWithinApp(entry)).toBe(false);
    expect(history.state.host).toBe("preserved");
    expect(readAppHistoryEntry(history.state)).toEqual(entry);
    expect(history.replaceState).toHaveBeenCalledWith(
      expect.any(Object),
      "",
    );
    expect(history.replaceState.mock.calls[0]).toHaveLength(2);
  });

  it("pushes distinct entries in the same app history session", () => {
    const history = makeHistory();
    initializeAppHistory(history, makeSnapshot());
    const first = pushAppHistoryEntry(
      history,
      makeSnapshot({ selectedGroup: "8" }),
    );
    const second = pushAppHistoryEntry(
      history,
      makeSnapshot({ selectedGroup: "8", week: 5 }),
    );

    expect(first.index).toBe(1);
    expect(second.index).toBe(2);
    expect(second.sessionId).toBe(first.sessionId);
    expect(canGoBackWithinApp(second)).toBe(true);
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.pushState.mock.calls.every((call) => call.length === 2)).toBe(true);
    expect(history.state.host).toBe("preserved");
  });

  it("tracks the game entry as the base for nested team details", () => {
    const history = makeHistory();
    initializeAppHistory(history, makeSnapshot());
    const gameEntry = pushAppHistoryEntry(history, makeSnapshot({
      modal: { type: "game", eventId: "event-1" },
    }));
    const entry = pushAppHistoryEntry(history, makeSnapshot({
      modal: { type: "team", teamId: "12" },
    }));

    expect(gameEntry.modalBaseIndex).toBe(0);
    expect(entry.modalBaseIndex).toBe(0);
    expect(canGoBackWithinApp(entry)).toBe(true);
    expect(readAppHistoryEntry(history.state)).toEqual(entry);
  });

  it("replaces the current state without creating a navigation step", () => {
    const history = makeHistory();
    initializeAppHistory(history, makeSnapshot());
    pushAppHistoryEntry(history, makeSnapshot({ week: 5 }));
    const replaced = replaceAppHistoryEntry(history, makeSnapshot({ week: 6 }));

    expect(replaced.index).toBe(1);
    expect(replaced.snapshot.week).toBe(6);
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.replaceState.mock.calls.at(-1)).toHaveLength(2);
  });

  it("ignores invalid app state and initializes a clean root", () => {
    const history = makeHistory({ __sportsScoreboard: { version: 99 } });

    expect(readAppHistoryEntry(history.state)).toBeNull();
    expect(initializeAppHistory(history, makeSnapshot()).index).toBe(0);
    expect(history.state.host).toBeUndefined();
  });
});