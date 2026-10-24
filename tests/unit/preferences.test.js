import { describe, expect, it, vi } from "vitest";
import {
  createDefaultPreferences,
  loadPreferences,
  moveLeague,
  normalizePreferences,
  savePreferences,
  setLeagueVisibility,
  toggleFavoriteTeam,
} from "../../src/app/preferences.js";
import { LEAGUE_IDS } from "../../src/app/leagues.js";

function makeStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
  };
}

describe("user preferences", () => {
  it("defaults to all leagues visible in their canonical order", () => {
    expect(createDefaultPreferences()).toMatchObject({
      version: 1,
      visibleLeagues: LEAGUE_IDS,
      leagueOrder: LEAGUE_IDS,
      favoriteTeams: Object.fromEntries(LEAGUE_IDS.map((league) => [league, []])),
    });
  });

  it("normalizes unsupported, duplicate, and missing league values", () => {
    const preferences = normalizePreferences({
      version: 1,
      visibleLeagues: ["nfl", "nfl", "unsupported"],
      leagueOrder: ["nba", "nba", "unsupported"],
    });

    expect(preferences.visibleLeagues).toEqual(["nfl"]);
    expect(preferences.leagueOrder).toEqual([
      "nba",
      "college-football",
      "nfl",
      "mlb",
      "nhl",
    ]);
  });

  it("falls back to defaults for malformed, unavailable, or unsupported storage", () => {
    expect(loadPreferences(makeStorage("not-json"))).toEqual(createDefaultPreferences());
    expect(loadPreferences(makeStorage(JSON.stringify({ version: 99 })))).toEqual(
      createDefaultPreferences(),
    );
    expect(loadPreferences(null)).toEqual(createDefaultPreferences());
    expect(loadPreferences({ getItem: () => { throw new Error("blocked"); } })).toEqual(
      createDefaultPreferences(),
    );
  });

  it("persists normalized preferences and tolerates storage write failures", () => {
    const storage = makeStorage();
    const preferences = createDefaultPreferences();
    preferences.visibleLeagues = ["nfl", "nfl"];

    expect(savePreferences(preferences, storage)).toBe(true);
    expect(JSON.parse(storage.getItem())).toMatchObject({ visibleLeagues: ["nfl"] });
    expect(savePreferences(preferences, { setItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(savePreferences(preferences, null)).toBe(false);
  });

  it("keeps at least one league visible", () => {
    let preferences = createDefaultPreferences();
    for (const league of LEAGUE_IDS.slice(1)) {
      preferences = setLeagueVisibility(preferences, league, false);
    }

    expect(preferences.visibleLeagues).toEqual([LEAGUE_IDS[0]]);
    expect(setLeagueVisibility(preferences, LEAGUE_IDS[0], false).visibleLeagues).toEqual([
      LEAGUE_IDS[0],
    ]);
  });

  it("moves a league while preserving the full order", () => {
    const moved = moveLeague(createDefaultPreferences(), "nfl", -1);
    expect(moved.leagueOrder).toEqual([
      "nfl",
      "college-football",
      "mlb",
      "nba",
      "nhl",
    ]);
    expect(moveLeague(moved, "nfl", -1).leagueOrder).toEqual(moved.leagueOrder);
  });

  it("toggles team-ID favorites independently per league and ignores duplicates", () => {
    const team = { id: "12", name: "Kansas City", abbreviation: "KC", logo: "kc.png" };
    let preferences = toggleFavoriteTeam(createDefaultPreferences(), "nfl", team);
    preferences = toggleFavoriteTeam(preferences, "nfl", team);
    preferences = toggleFavoriteTeam(preferences, "mlb", team);

    expect(preferences.favoriteTeams.nfl).toEqual([]);
    expect(preferences.favoriteTeams.mlb).toEqual([team]);
  });

  it("deduplicates and sanitizes stored favorite team metadata", () => {
    const preferences = normalizePreferences({
      version: 1,
      favoriteTeams: {
        nfl: [
          { id: 12, name: "Kansas City" },
          { id: "12", name: "Duplicate" },
          { name: "Missing ID" },
        ],
      },
    });

    expect(preferences.favoriteTeams.nfl).toEqual([
      { id: "12", name: "Kansas City", abbreviation: "", logo: "" },
    ]);
  });
});