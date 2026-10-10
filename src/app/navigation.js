const HISTORY_STATE_KEY = "__sportsScoreboard";
const HISTORY_STATE_VERSION = 1;
const SUPPORTED_LEAGUES = new Set([
  "college-football",
  "nfl",
  "mlb",
  "nba",
  "nhl",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidModal(modal) {
  if (modal === null) return true;
  if (!isObject(modal)) return false;
  if (modal.type === "game") return typeof modal.eventId === "string" && modal.eventId.length > 0;
  if (modal.type === "team") return typeof modal.teamId === "string" && modal.teamId.length > 0;
  return false;
}

function isValidSnapshot(snapshot) {
  return (
    isObject(snapshot) &&
    SUPPORTED_LEAGUES.has(snapshot.league) &&
    ["scoreboard", "standings"].includes(snapshot.view) &&
    Number.isInteger(snapshot.week) &&
    snapshot.week >= 1 &&
    Number.isInteger(snapshot.seasonType) &&
    typeof snapshot.selectedGroup === "string" &&
    typeof snapshot.selectedDate === "string" &&
    isValidModal(snapshot.modal)
  );
}

function isValidEntry(entry) {
  return (
    isObject(entry) &&
    entry.version === HISTORY_STATE_VERSION &&
    Number.isInteger(entry.index) &&
    Number.isInteger(entry.rootIndex) &&
    entry.index >= entry.rootIndex &&
    (entry.modalBaseIndex === null ||
      (Number.isInteger(entry.modalBaseIndex) &&
        entry.modalBaseIndex >= entry.rootIndex &&
        entry.modalBaseIndex <= entry.index)) &&
    isValidSnapshot(entry.snapshot)
  );
}

function mergeHistoryState(history, entry) {
  const state = isObject(history.state) ? history.state : {};
  return { ...state, [HISTORY_STATE_KEY]: entry };
}

export function readAppHistoryEntry(state) {
  const entry = isObject(state) ? state[HISTORY_STATE_KEY] : null;
  return isValidEntry(entry) ? entry : null;
}

export function initializeAppHistory(history, snapshot) {
  const current = readAppHistoryEntry(history.state);
  if (current) return current;

  const entry = {
    version: HISTORY_STATE_VERSION,
    index: 0,
    rootIndex: 0,
    modalBaseIndex: null,
    snapshot,
  };
  history.replaceState(mergeHistoryState(history, entry), "");
  return entry;
}

export function pushAppHistoryEntry(history, snapshot) {
  const current = readAppHistoryEntry(history.state);
  const rootIndex = current?.rootIndex ?? 0;
  const index = (current?.index ?? rootIndex) + 1;
  const modalBaseIndex = snapshot.modal
    ? current?.snapshot.modal
      ? current.modalBaseIndex
      : current?.index ?? rootIndex
    : null;
  const entry = {
    version: HISTORY_STATE_VERSION,
    index,
    rootIndex,
    modalBaseIndex,
    snapshot,
  };
  history.pushState(mergeHistoryState(history, entry), "");
  return entry;
}

export function replaceAppHistoryEntry(history, snapshot) {
  const current = readAppHistoryEntry(history.state);
  const rootIndex = current?.rootIndex ?? 0;
  const index = current?.index ?? rootIndex;
  const entry = {
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

export function canGoBackWithinApp(entry) {
  return isValidEntry(entry) && entry.index > entry.rootIndex;
}