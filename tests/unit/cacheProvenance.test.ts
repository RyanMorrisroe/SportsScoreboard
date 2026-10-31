import { describe, expect, it } from "vitest";
import { useCacheProvenance } from "../../src/composables/useCacheProvenance";

describe("cache provenance", () => {
  it("retains the oldest timestamp while any displayed resource is cached", () => {
    const provenance = useCacheProvenance();
    provenance.markCached(200);
    provenance.onCacheFallback("https://espn.test/team", 100);

    expect(provenance.showingCachedData.value).toBe(true);
    expect(provenance.cachedAt.value).toBe(100);
  });

  it("supports legacy snapshots without a timestamp and clears after fresh data", () => {
    const provenance = useCacheProvenance();
    provenance.markCached();

    expect(provenance.showingCachedData.value).toBe(true);
    expect(provenance.cachedAt.value).toBeNull();

    provenance.clear();

    expect(provenance.showingCachedData.value).toBe(false);
    expect(provenance.cachedAt.value).toBeNull();
  });
});
