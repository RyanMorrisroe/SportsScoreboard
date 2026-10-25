import { LEAGUE_IDS } from "./leagues";
import type { LeagueId } from "../plugins/registry";

const HISTORY_STATE_KEY = "__sportsScoreboard";
const HISTORY_STATE_VERSION = 1;
const SUPPORTED_LEAGUES = new Set<string>(LEAGUE_IDS);

export type AppView = "scoreboard" | "standings" | "tv-lineup";

export type AppModalSnapshot =
  | { type: "game"; eventId: string }
  | {
      type: "team";
      teamId: string;
      team?: {
        id: string;
        name?: string;
        abbrev?: string;
        abbreviation?: string;
        logo?: string;
      };
      source?: "game" | "standings";
      gameId?: string;
      side?: "away" | "home";
    }
  | null;

export interface AppSnapshot {
  league: LeagueId;
  view: AppView;
  week: number;
  seasonType: number;
  selectedGroup: string;
  selectedDate: string;
  modal: AppModalSnapshot;
}

export interface AppHistoryEntry {
  version: typeof HISTORY_STATE_VERSION;
  index: number;
  rootIndex: number;
  modalBaseIndex: number | null;
  snapshot: AppSnapshot;
}

export interface AppHistory {
  state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidModal(modal: unknown): modal is AppModalSnapshot {
  if (modal === null) return true;
  if (!isObject(modal)) return false;
  if (modal.type === "game") return typeof modal.eventId === "string" && modal.eventId.length > 0;
  if (modal.type === "team") {
    const team = modal.team;
    const validTeam = team === undefined ||
      (isObject(team) && typeof team.id === "string" &&
        ["name", "abbrev", "abbreviation", "logo"].every(
          (key) => team[key] === undefined || typeof team[key] === "string",
        ));
    return typeof modal.teamId === "string" && modal.teamId.length > 0 &&
      validTeam &&
      (modal.source === undefined || modal.source === "game" || modal.source === "standings") &&
      (modal.gameId === undefined || typeof modal.gameId === "string") &&
      (modal.side === undefined || modal.side === "away" || modal.side === "home");
  }
  return false;
}

function isValidSnapshot(snapshot: unknown): snapshot is AppSnapshot {
  if (!isObject(snapshot)) return false;
  return (
    typeof snapshot.league === "string" && SUPPORTED_LEAGUES.has(snapshot.league) &&
    ["scoreboard", "standings", "tv-lineup"].includes(String(snapshot.view)) &&
    Number.isInteger(snapshot.week) && Number(snapshot.week) >= 1 &&
    Number.isInteger(snapshot.seasonType) &&
    typeof snapshot.selectedGroup === "string" &&
    typeof snapshot.selectedDate === "string" &&
    isValidModal(snapshot.modal)
  );
}

function isValidEntry(entry: unknown): entry is AppHistoryEntry {
  if (!isObject(entry)) return false;
  return (
    entry.version === HISTORY_STATE_VERSION &&
    Number.isInteger(entry.index) &&
    Number.isInteger(entry.rootIndex) &&
    Number(entry.index) >= Number(entry.rootIndex) &&
    (entry.modalBaseIndex === null ||
      (Number.isInteger(entry.modalBaseIndex) &&
        Number(entry.modalBaseIndex) >= Number(entry.rootIndex) &&
        Number(entry.modalBaseIndex) <= Number(entry.index))) &&
    isValidSnapshot(entry.snapshot)
  );
}

function mergeHistoryState(history: AppHistory, entry: AppHistoryEntry): Record<string, unknown> {
  const state = isObject(history.state) ? history.state : {};
  return { ...state, [HISTORY_STATE_KEY]: entry };
}

export function readAppHistoryEntry(state: unknown): AppHistoryEntry | null {
  const entry = isObject(state) ? state[HISTORY_STATE_KEY] : null;
  return isValidEntry(entry) ? entry : null;
}

export function initializeAppHistory(
  history: AppHistory,
  snapshot: AppSnapshot,
): AppHistoryEntry {
  const current = readAppHistoryEntry(history.state);
  if (current) return current;

  const entry: AppHistoryEntry = {
    version: HISTORY_STATE_VERSION,
    index: 0,
    rootIndex: 0,
    modalBaseIndex: null,
    snapshot,
  };
  history.replaceState(mergeHistoryState(history, entry), "");
  return entry;
}

export function pushAppHistoryEntry(
  history: AppHistory,
  snapshot: AppSnapshot,
): AppHistoryEntry {
  const current = readAppHistoryEntry(history.state);
  const rootIndex = current?.rootIndex ?? 0;
  const index = (current?.index ?? rootIndex) + 1;
  const modalBaseIndex = snapshot.modal
    ? current?.snapshot.modal
      ? current.modalBaseIndex
      : current?.index ?? rootIndex
    : null;
  const entry: AppHistoryEntry = {
    version: HISTORY_STATE_VERSION,
    index,
    rootIndex,
    modalBaseIndex,
    snapshot,
  };
  history.pushState(mergeHistoryState(history, entry), "");
  return entry;
}

export function replaceAppHistoryEntry(
  history: AppHistory,
  snapshot: AppSnapshot,
): AppHistoryEntry {
  const current = readAppHistoryEntry(history.state);
  const rootIndex = current?.rootIndex ?? 0;
  const index = current?.index ?? rootIndex;
  const entry: AppHistoryEntry = {
    version: HISTORY_STATE_VERSION,
    index,
    rootIndex,
    modalBaseIndex: snapshot.modal
      ? current?.modalBaseIndex ?? index
      : null,
    snapshot,
  };
  history.replaceState(mergeHistoryState(history, entry), "");
  return entry;
}

export function canGoBackWithinApp(entry: unknown): entry is AppHistoryEntry {
  return isValidEntry(entry) && entry.index > entry.rootIndex;
}

export function reconcileAppSnapshot(
  snapshot: AppSnapshot,
  visibleLeagues: readonly string[],
  fallbackLeague: LeagueId,
): AppSnapshot {
  if (visibleLeagues.includes(snapshot.league)) return snapshot;
  return { ...snapshot, league: fallbackLeague, modal: null };
}