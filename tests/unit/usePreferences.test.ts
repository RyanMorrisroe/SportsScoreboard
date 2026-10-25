import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { fetchStandings } from "../../src/api/espn";
import { createDefaultPreferences } from "../../src/app/preferences";
import type { LeagueId } from "../../src/plugins/registry";
import { usePreferences } from "../../src/composables/usePreferences";

vi.mock("../../src/api/espn", () => ({
  fetchStandings: vi.fn(),
}));

const standingsPayload = {
  children: [{
    id: "conference",
    name: "Conference",
    standings: {
      entries: [
        {
          team: {
            id: "12",
            displayName: "Kansas City",
            abbreviation: "KC",
            logo: "kc.png",
          },
        },
        {
          team: {
            id: "13",
            displayName: "Buffalo",
            abbreviation: "BUF",
            logo: "buf.png",
          },
        },
      ],
    },
  }],
};

function setup() {
  const preferences = ref(createDefaultPreferences());
  const selectedLeague = ref<LeagueId>("nfl");
  const fetchImpl = vi.fn() as unknown as typeof fetch;
  return {
    preferences,
    selectedLeague,
    subject: usePreferences(preferences, selectedLeague, fetchImpl),
  };
}

describe("preferences composable", () => {
  beforeEach(() => {
    vi.mocked(fetchStandings).mockReset();
  });

  it("loads, caches, and filters selectable favorite teams", async () => {
    vi.mocked(fetchStandings).mockResolvedValue(standingsPayload);
    const { subject } = setup();

    await subject.loadFavoriteTeamOptions("nfl");

    expect(subject.teamOptionsLoading.value).toBe(false);
    expect(subject.teamOptionsByLeague.value.nfl).toEqual([
      { id: "13", name: "Buffalo", abbreviation: "BUF", logo: "buf.png" },
      { id: "12", name: "Kansas City", abbreviation: "KC", logo: "kc.png" },
    ]);
    subject.favoriteSearch.value = "kan";
    expect(subject.filteredTeamOptions.value.map((team) => team.id)).toEqual(["12"]);

    await subject.loadFavoriteTeamOptions("nfl");
    expect(fetchStandings).toHaveBeenCalledTimes(1);
  });

  it("reports failed and empty standings responses and ignores unsupported leagues", async () => {
    vi.mocked(fetchStandings).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(fetchStandings).mockResolvedValueOnce({ children: [] });
    const { subject } = setup();

    await subject.loadFavoriteTeamOptions("nfl");
    expect(subject.teamOptionsError.value).toBe("offline");
    expect(subject.teamOptionsLoading.value).toBe(false);

    await subject.loadFavoriteTeamOptions("nba", true);
    expect(subject.teamOptionsError.value).toBe("No teams were returned for this league.");
    expect(subject.teamOptionsLoading.value).toBe(false);

    await subject.loadFavoriteTeamOptions("unsupported");
    expect(fetchStandings).toHaveBeenCalledTimes(2);
  });

  it("resets settings state and ignores an in-flight request after closing", async () => {
    let resolveStandings!: (value: unknown) => void;
    vi.mocked(fetchStandings).mockReturnValueOnce(new Promise((resolve) => {
      resolveStandings = resolve;
    }));
    const { subject, selectedLeague } = setup();
    subject.favoriteSearch.value = "old query";
    subject.favoriteLeague.value = "mlb";

    subject.openSettings();
    expect(subject.settingsOpen.value).toBe(true);
    expect(subject.favoriteLeague.value).toBe("nfl");
    expect(subject.favoriteSearch.value).toBe("");

    subject.closeSettings();
    selectedLeague.value = "nba";
    resolveStandings(standingsPayload);
    await Promise.resolve();
    await Promise.resolve();

    expect(subject.settingsOpen.value).toBe(false);
    expect(subject.teamOptionsByLeague.value.nfl).toBeUndefined();
    expect(subject.teamOptionsLoading.value).toBe(false);
  });

  it("updates league visibility/order and favorites without allowing all leagues to hide", () => {
    const { preferences, selectedLeague, subject } = setup();
    const fallbackLeague = subject.setLeagueVisibility("nfl", false);

    expect(fallbackLeague).toBe("college-football");
    expect(preferences.value.visibleLeagues).not.toContain("nfl");
    subject.setLeagueVisibility("college-football", false);
    subject.setLeagueVisibility("mlb", false);
    subject.setLeagueVisibility("nba", false);
    subject.setLeagueVisibility("nhl", false);
    expect(preferences.value.visibleLeagues).toEqual(["nhl"]);

    subject.moveLeagueInOrder("nfl", -1);
    expect(preferences.value.leagueOrder[0]).toBe("nfl");
    subject.toggleFavorite({ id: 12, name: "Kansas City" });
    expect(subject.selectedFavoriteTeams.value).toEqual([
      { id: "12", name: "Kansas City", abbreviation: "", logo: "" },
    ]);
    expect(subject.isFavoriteTeam(12)).toBe(true);

    selectedLeague.value = "nba";
    expect(subject.favoriteTeamIds.value).toEqual([]);
  });
});