import { computed, ref, type Ref } from "vue";
import { fetchJson as requestJson, getGameSummaryUrl, getTeamUrls } from "../api/espn";
import { getGameState } from "../app/scoreboard.js";
import { buildGameDetail, type GameDetail } from "../domain/game";
import type { LeagueId } from "../plugins/registry";

type JsonObject = Record<string, unknown>;

interface SelectedGame {
  id?: string | number;
  status?: unknown;
}

interface GameDetailsSelection {
  selectedLeague: Ref<LeagueId>;
  showModal: Ref<boolean>;
  modalView: Ref<string>;
  selectedGame: Ref<SelectedGame | null>;
  modalTab: Ref<string>;
}

interface GameDetailsDependencies {
  fetchJson: (url: string, fetchImpl?: typeof fetch) => Promise<unknown>;
  fetchImpl: typeof fetch;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getId(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function useGameDetails(
  selection: GameDetailsSelection,
  dependencies: Partial<GameDetailsDependencies> = {},
) {
  const modalLoading = ref(false);
  const modalData = ref<GameDetail | null>(null);
  const matchupSchedules = ref<Record<string, unknown>>({});
  const matchupLoading = ref(false);
  const fetch = dependencies.fetchJson ?? requestJson;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  let requestId = 0;

  const modalGameStatus = computed(() => {
    const raw = asObject(modalData.value?.raw);
    const header = asObject(raw.header);
    const competition = asObject(asArray(header.competitions)[0]);
    const summaryStatus = asObject(asObject(competition.status).type).state;
    return String(summaryStatus || getGameState(selection.selectedGame.value)).toLowerCase();
  });

  async function fetchMatchupSchedules(
    raw: unknown,
    eventId: string | number,
    currentRequestId: number,
  ): Promise<void> {
    const header = asObject(asObject(raw).header);
    const competition = asObject(asArray(header.competitions)[0]);
    const competitors = asArray(competition.competitors);
    const summaryTeams = asArray(asObject(raw).lastFiveGames);
    const missingTeamIds = competitors
      .map((value) => {
        const competitor = asObject(value);
        return getId(competitor.id ?? asObject(competitor.team).id);
      })
      .filter((teamId) => teamId && !summaryTeams.some((value) => {
        const entry = asObject(value);
        return getId(asObject(entry.team).id) === teamId &&
          asArray(entry.events).length > 0;
      }));

    if (!missingTeamIds.length) {
      matchupLoading.value = false;
      return;
    }

    matchupLoading.value = true;
    try {
      const schedules = await Promise.all(missingTeamIds.map(async (teamId) => {
        try {
          const urls = getTeamUrls(selection.selectedLeague.value, teamId);
          return [teamId, await fetch(urls.schedule, fetchImpl)] as const;
        } catch {
          return [teamId, null] as const;
        }
      }));
      if (
        currentRequestId === requestId &&
        selection.showModal.value &&
        String(selection.selectedGame.value?.id) === String(eventId)
      ) {
        matchupSchedules.value = Object.fromEntries(schedules);
      }
    } finally {
      if (currentRequestId === requestId) matchupLoading.value = false;
    }
  }

  async function fetchGameDetail(eventId: string | number): Promise<void> {
    const currentRequestId = ++requestId;
    modalLoading.value = true;
    try {
      const endpoint = getGameSummaryUrl(selection.selectedLeague.value, String(eventId));
      const data = await fetch(endpoint);
      if (
        currentRequestId !== requestId ||
        !selection.showModal.value ||
        selection.modalView.value !== "game" ||
        String(selection.selectedGame.value?.id) !== String(eventId)
      ) return;

      const previousStatus = modalGameStatus.value;
      modalData.value = buildGameDetail(data, eventId);
      const isPregame = modalGameStatus.value === "pre";
      if ((previousStatus === "pre") !== isPregame) {
        selection.modalTab.value = isPregame ? "matchup" : "stats";
      }
      void fetchMatchupSchedules(data, eventId, currentRequestId);
    } catch (error) {
      if (currentRequestId === requestId) {
        console.error("Summary payload details parse error:", error);
        modalData.value = null;
      }
    } finally {
      if (currentRequestId === requestId) modalLoading.value = false;
    }
  }

  function invalidateGameDetails(): void {
    requestId++;
  }

  function resetMatchupSchedules(): void {
    matchupSchedules.value = {};
    matchupLoading.value = false;
  }

  return {
    modalLoading,
    modalData,
    modalGameStatus,
    matchupSchedules,
    matchupLoading,
    fetchGameDetail,
    invalidateGameDetails,
    resetMatchupSchedules,
  };
}
