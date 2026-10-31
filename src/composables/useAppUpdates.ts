import { ref, type Ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Preferences } from "../app/preferences";

export interface AppUpdate {
  version: string;
  notes: string;
  downloadUrl: string;
}

export function useAppUpdates(preferences: Ref<Preferences>) {
  const update = ref<AppUpdate | null>(null);
  const checking = ref(false);
  const checked = ref(false);
  const error = ref("");
  const downloadErrorDetails = ref("");
  const noticeDismissed = ref(false);

  async function checkForUpdates(automatic = false): Promise<void> {
    if (!isTauri() || (automatic && !preferences.value.autoCheckForUpdates) || checking.value) {
      return;
    }

    checking.value = true;
    error.value = "";
    downloadErrorDetails.value = "";
    noticeDismissed.value = false;
    try {
      update.value = await invoke<AppUpdate | null>("check_for_updates");
    } catch {
      update.value = null;
      error.value = "Unable to check for updates. Please try again.";
    } finally {
      checked.value = true;
      checking.value = false;
    }
  }

  async function openUpdateDownload(): Promise<void> {
    if (!isTauri() || !update.value) return;

    error.value = "";
    downloadErrorDetails.value = "";
    try {
      await openUrl(update.value.downloadUrl);
    } catch (reason) {
      const message = (reason instanceof Error ? reason.message : String(reason))
        .replace(/\s+/g, " ")
        .slice(0, 240);
      error.value = "Unable to open the update download.";
      downloadErrorDetails.value = `${message || "Unknown opener error"}\nURL: ${update.value.downloadUrl}`;
    }
  }

  function dismissUpdateNotice(): void {
    noticeDismissed.value = true;
  }

  return {
    update,
    checking,
    checked,
    error,
    downloadErrorDetails,
    noticeDismissed,
    checkForUpdates,
    openUpdateDownload,
    dismissUpdateNotice,
  };
}