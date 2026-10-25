import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { AppHistory } from "../../src/app/navigation";
import { useAppNavigation } from "../../src/composables/useAppNavigation";
import type { LeagueId } from "../../src/plugins/registry";

function makeHistory(state: unknown = null) {
  return {
    state,
    pushState: vi.fn(function (this: AppHistory, nextState: unknown, _title: string) {
      this.state = nextState;
    }),
    replaceState: vi.fn(function (this: AppHistory, nextState: unknown, _title: string) {
      this.state = nextState;
    }),
  } satisfies AppHistory & {
    pushState: ReturnType<typeof vi.fn>;
    replaceState: ReturnType<typeof vi.fn>;
  };
}

function makeState() {
  return {
    selectedLeague: ref<LeagueId>("nfl"),
    viewMode: ref<"scoreboard" | "standings" | "tv-lineup">("scoreboard"),
    week: ref(1),
    seasonType: ref(2),
    selectedGroup: ref("80"),
    selectedDate: ref("2026-10-24"),
  };
}

describe("app navigation composable", () => {
  it("initializes state, preserves modal snapshots, and replaces without a new step", () => {
    const state = makeState();
    const history = makeHistory();
    const navigation = useAppNavigation(
      state,
      ["nfl", "nba"],
      "nfl",
      history,
    );

    expect(navigation.hasSavedNavigation).toBe(false);
    expect(navigation.initialNavigationEntry.snapshot.league).toBe("nfl");
    const gameEntry = navigation.pushNavigationEntry({
      type: "game",
      eventId: "event-1",
    });
    const keptModal = navigation.replaceCurrentNavigationEntry();
    const closedModal = navigation.replaceCurrentNavigationEntry(null);

    expect(gameEntry.index).toBe(1);
    expect(keptModal.snapshot.modal).toEqual({ type: "game", eventId: "event-1" });
    expect(closedModal.index).toBe(1);
    expect(closedModal.snapshot.modal).toBeNull();
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });

  it("reconciles hidden leagues and closes a modal from saved history", () => {
    const history = makeHistory({
      __sportsScoreboard: {
        version: 1,
        index: 2,
        rootIndex: 0,
        modalBaseIndex: 1,
        snapshot: {
          league: "nfl",
          view: "scoreboard",
          week: 4,
          seasonType: 2,
          selectedGroup: "",
          selectedDate: "2026-10-24",
          modal: { type: "game", eventId: "event-1" },
        },
      },
    });
    const state = makeState();

    const navigation = useAppNavigation(state, ["nba"], "nba", history);

    expect(navigation.hasSavedNavigation).toBe(true);
    expect(state.selectedLeague.value).toBe("nba");
    expect(state.week.value).toBe(4);
    expect(navigation.initialNavigationEntry.snapshot.modal).toBeNull();
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });
});