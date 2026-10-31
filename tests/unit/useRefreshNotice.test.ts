import { computed, effectScope, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRefreshNotice } from "../../src/composables/useRefreshNotice";

describe("useRefreshNotice", () => {
  afterEach(() => vi.useRealTimers());

  it("becomes stale only after one minute and clears on a successful refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const scope = effectScope();
    const lastRefresh = ref<number | null>(null);
    const isLive = ref(true);
    const isStale = scope.run(() =>
      useRefreshNotice(lastRefresh, computed(() => isLive.value)),
    )!;

    lastRefresh.value = Date.now();
    vi.advanceTimersByTime(60_000);
    expect(isStale.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isStale.value).toBe(true);

    lastRefresh.value = Date.now();
    expect(isStale.value).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(isStale.value).toBe(true);

    scope.stop();
    vi.advanceTimersByTime(60_001);
  });

  it("stays hidden without a live game and resets when a game finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const scope = effectScope();
    const lastRefresh = ref<number | null>(0);
    const isLive = ref(true);
    const isStale = scope.run(() =>
      useRefreshNotice(lastRefresh, computed(() => isLive.value)),
    )!;

    vi.advanceTimersByTime(60_001);
    expect(isStale.value).toBe(true);
    isLive.value = false;
    expect(isStale.value).toBe(false);

    scope.stop();
  });
});