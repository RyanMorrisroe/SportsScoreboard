import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { createDefaultPreferences } from "../../src/app/preferences";
import { useAppUpdates } from "../../src/composables/useAppUpdates";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("app update checks", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(isTauri).mockReset();
    vi.mocked(openUrl).mockReset();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it("does not invoke the native check when automatic checks are disabled", async () => {
    const preferences = ref({ ...createDefaultPreferences(), autoCheckForUpdates: false });
    const updates = useAppUpdates(preferences);

    await updates.checkForUpdates(true);

    expect(invoke).not.toHaveBeenCalled();
    expect(updates.checked.value).toBe(false);
  });

  it("allows a manual check while automatic checks are disabled", async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const preferences = ref({ ...createDefaultPreferences(), autoCheckForUpdates: false });
    const updates = useAppUpdates(preferences);

    await updates.checkForUpdates();

    expect(invoke).toHaveBeenCalledWith("check_for_updates");
    expect(updates.checked.value).toBe(true);
    expect(updates.error.value).toBe("");
  });

  it("skips checks outside Tauri and reports failures without throwing", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const updates = useAppUpdates(ref(createDefaultPreferences()));
    await updates.checkForUpdates(true);
    expect(invoke).not.toHaveBeenCalled();

    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockRejectedValue(new Error("offline"));
    await updates.checkForUpdates(true);
    expect(updates.checked.value).toBe(true);
    expect(updates.error.value).toBe("Unable to check for updates. Please try again.");
  });

  it("opens the selected update asset through the system opener", async () => {
    vi.mocked(invoke).mockResolvedValue({
      version: "1.8.0-wrapper.0.1.0",
      notes: "Release notes",
      downloadUrl: "https://github.com/RyanMorrisroe/SportsScoreboard-Native/releases/download/v1.8.0-wrapper.0.1.0/app.apk",
    });
    const updates = useAppUpdates(ref(createDefaultPreferences()));
    await updates.checkForUpdates();
    await updates.openUpdateDownload();

    expect(openUrl).toHaveBeenCalledWith(
      "https://github.com/RyanMorrisroe/SportsScoreboard-Native/releases/download/v1.8.0-wrapper.0.1.0/app.apk",
    );
  });
});