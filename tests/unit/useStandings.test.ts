import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { fetchStandings } from "../../src/api/espn";
import { useStandings } from "../../src/composables/useStandings";
import type { LeagueId } from "../../src/plugins/registry";

vi.mock("../../src/api/espn", () => ({
  fetchStandings: vi.fn(),
}));

const standingsPayload = {
  children: [
    {
      id: "east",
      name: "Eastern Conference",
      standings: {
        entries: [
          {
            team: { id: "2", displayName: "Boston" },
            stats: [
              { name: "rank", displayValue: "2" },
              { name: "wins", displayValue: "4" },
            ],
          },
          {
            team: { id: "1", displayName: "Atlanta" },
            stats: [
              { name: "rank", displayValue: "1" },
              { name: "wins", displayValue: "7" },
            ],
          },
        ],
      },
    },
  ],
};

function setup() {
  const selectedLeague = ref<LeagueId>("nba");
  const fetchImpl = vi.fn() as unknown as typeof fetch;
  return {
    selectedLeague,
    subject: useStandings(selectedLeague, fetchImpl),
  };
}

describe("standings composable", () => {
  beforeEach(() => {
    vi.mocked(fetchStandings).mockReset();
  });

  it("loads normalized groups and applies the position sort by default", async () => {
    vi.mocked(fetchStandings).mockResolvedValue(standingsPayload);
    const { selectedLeague, subject } = setup();

    await subject.fetchStandings();

    expect(fetchStandings).toHaveBeenCalledWith("nba", expect.any(Function), {
      onCacheFallback: expect.any(Function),
    });
    expect(subject.standingsLoading.value).toBe(false);
    expect(subject.standingsError.value).toBe("");
    expect(subject.standings.value[0]?.name).toBe("Eastern Conference");
    expect(subject.getStandingSortDirection("east", "rank")).toBe("asc");
    expect(
      subject
        .getSortedStandingTeams(subject.standings.value[0]!)
        .map((team) => team.name),
    ).toEqual(["Atlanta", "Boston"]);
    expect(
      subject.getStandingStat(subject.standings.value[0]!.teams[0]!, "missing"),
    ).toBe("--");

    selectedLeague.value = "nfl";
    expect(selectedLeague.value).toBe("nfl");
  });

  it("marks cached standings and clears provenance after a fresh network response", async () => {
    vi.mocked(fetchStandings)
      .mockImplementationOnce(async (_league, _fetch, options) => {
        options?.onCacheFallback?.("https://espn.test/standings", 100);
        return standingsPayload;
      })
      .mockResolvedValueOnce(standingsPayload);
    const { subject } = setup();

    await subject.fetchStandings();
    expect(subject.showingCachedData.value).toBe(true);
    expect(subject.cachedAt.value).toBe(100);

    await subject.fetchStandings();
    expect(subject.showingCachedData.value).toBe(false);
    expect(subject.cachedAt.value).toBeNull();
  });

  it("cycles a group sort from ascending to descending to unsorted", async () => {
    vi.mocked(fetchStandings).mockResolvedValue(standingsPayload);
    const { subject } = setup();
    await subject.fetchStandings();

    subject.toggleStandingsSort("east", "wins");
    expect(subject.getStandingSortDirection("east", "wins")).toBe("asc");
    subject.toggleStandingsSort("east", "wins");
    expect(subject.getStandingSortDirection("east", "wins")).toBe("desc");
    expect(
      subject
        .getSortedStandingTeams(subject.standings.value[0]!)
        .map((team) => team.name),
    ).toEqual(["Atlanta", "Boston"]);
    subject.toggleStandingsSort("east", "wins");
    expect(subject.getStandingSortDirection("east", "wins")).toBeNull();
  });

  it("exposes fetch failures and ignores stale results after reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetchStandings).mockRejectedValueOnce(new Error("offline"));
    const { subject } = setup();

    await subject.fetchStandings();
    expect(subject.standingsError.value).toBe("offline");
    expect(subject.standingsLoading.value).toBe(false);

    let resolveStandings!: (value: unknown) => void;
    vi.mocked(fetchStandings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStandings = resolve;
      }),
    );
    const pending = subject.fetchStandings();
    subject.resetStandings();
    resolveStandings(standingsPayload);
    await pending;

    expect(subject.standings.value).toEqual([]);
    expect(subject.standingsError.value).toBe("");
    expect(subject.standingsLoading.value).toBe(false);
    vi.restoreAllMocks();
  });
});
