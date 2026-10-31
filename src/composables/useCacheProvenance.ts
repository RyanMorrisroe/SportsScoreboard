import { ref } from "vue";

export function useCacheProvenance() {
  const showingCachedData = ref(false);
  const cachedAt = ref<number | null>(null);

  function markCached(savedAt?: number): void {
    showingCachedData.value = true;
    if (typeof savedAt === "number" && Number.isFinite(savedAt)) {
      cachedAt.value =
        cachedAt.value === null ? savedAt : Math.min(cachedAt.value, savedAt);
    }
  }

  function onCacheFallback(_url: string, savedAt: number): void {
    markCached(savedAt);
  }

  function clear(): void {
    showingCachedData.value = false;
    cachedAt.value = null;
  }

  return { showingCachedData, cachedAt, markCached, onCacheFallback, clear };
}
