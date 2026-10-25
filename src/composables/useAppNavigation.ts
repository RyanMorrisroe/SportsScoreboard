import type { Ref } from "vue";
import {
  initializeAppHistory,
  pushAppHistoryEntry,
  readAppHistoryEntry,
  reconcileAppSnapshot,
  replaceAppHistoryEntry,
  type AppHistory,
  type AppHistoryEntry,
  type AppModalSnapshot,
  type AppSnapshot,
  type AppView,
} from "../app/navigation";
import type { LeagueId } from "../plugins/registry";

export interface NavigationStateRefs {
  selectedLeague: Ref<LeagueId>;
  viewMode: Ref<AppView>;
  week: Ref<number>;
  seasonType: Ref<number>;
  selectedGroup: Ref<string>;
  selectedDate: Ref<string>;
}

export function useAppNavigation(
  state: NavigationStateRefs,
  visibleLeagues: readonly LeagueId[],
  fallbackLeague: LeagueId,
  history: AppHistory = window.history,
) {
  function createNavigationSnapshot(modal: AppModalSnapshot = null): AppSnapshot {
    return {
      league: state.selectedLeague.value,
      view: state.viewMode.value,
      week: state.week.value,
      seasonType: state.seasonType.value,
      selectedGroup: state.selectedGroup.value,
      selectedDate: state.selectedDate.value,
      modal,
    };
  }

  function pushNavigationEntry(modal: AppModalSnapshot = null): AppHistoryEntry {
    return pushAppHistoryEntry(history, createNavigationSnapshot(modal));
  }

  function replaceCurrentNavigationEntry(modal?: AppModalSnapshot): AppHistoryEntry {
    const currentEntry = readAppHistoryEntry(history.state);
    const nextModal = modal === undefined ? currentEntry?.snapshot.modal ?? null : modal;
    return replaceAppHistoryEntry(history, createNavigationSnapshot(nextModal));
  }

  const hasSavedNavigation = Boolean(readAppHistoryEntry(history.state));
  let initialNavigationEntry = initializeAppHistory(history, createNavigationSnapshot());
  const initialSnapshot = reconcileAppSnapshot(
    initialNavigationEntry.snapshot,
    visibleLeagues,
    fallbackLeague,
  );
  if (initialSnapshot !== initialNavigationEntry.snapshot) {
    initialNavigationEntry = replaceAppHistoryEntry(history, initialSnapshot);
  }

  state.selectedLeague.value = initialNavigationEntry.snapshot.league;
  state.viewMode.value = initialNavigationEntry.snapshot.view;
  state.week.value = initialNavigationEntry.snapshot.week;
  state.seasonType.value = initialNavigationEntry.snapshot.seasonType;
  state.selectedGroup.value = initialNavigationEntry.snapshot.selectedGroup;
  state.selectedDate.value = initialNavigationEntry.snapshot.selectedDate;

  return {
    hasSavedNavigation,
    initialNavigationEntry,
    createNavigationSnapshot,
    pushNavigationEntry,
    replaceCurrentNavigationEntry,
  };
}