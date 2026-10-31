import { describe, expect, it, vi } from "vitest";
import {
  createGameCache,
  GAME_CACHE_TTL_MS,
  type GameCacheRecord,
  type GameCacheStorage,
} from "../../src/app/gameCache";

function makeStorage(initial: GameCacheRecord[] = []) {
  const records = new Map(initial.map((record) => [record.key, record]));
  const storage: GameCacheStorage = {
    get: vi.fn(async (key) => records.get(key) ?? null),
    put: vi.fn(async (record) => {
      records.set(record.key, record);
    }),
    delete: vi.fn(async (key) => {
      records.delete(key);
    }),
  };
  return { storage, records };
}

const finalEvent = { id: "final-1", status: { type: { state: "post" } } };
const liveEvent = { id: "live-1", status: { type: { state: "in" } } };
const finalSummary = {
  header: { competitions: [{ status: { type: { state: "post" } } }] },
};
const liveSummary = {
  header: { competitions: [{ status: { type: { state: "in" } } }] },
};

describe("completed game cache", () => {
  it("persists arbitrary URL responses across cache instances with a saved timestamp", async () => {
    const { storage } = makeStorage();
    const requestUrl = "https://espn.test/scoreboard?dates=20261031";
    const snapshot = {
      events: [{ id: "scheduled-1", status: { type: { state: "pre" } } }],
    };

    await createGameCache(storage).saveResponse(requestUrl, snapshot, 100);

    expect(await createGameCache(storage).getResponse(requestUrl, 101)).toEqual(
      {
        value: snapshot,
        savedAt: 100,
      },
    );
    expect(
      await createGameCache(storage).getResponse(`${requestUrl}&group=1`, 101),
    ).toBeNull();
    expect(
      await createGameCache(storage).getResponse(
        requestUrl,
        100 + GAME_CACHE_TTL_MS,
      ),
    ).toBeNull();
  });

  it("persists only completed events and isolates league/request keys", async () => {
    const { storage } = makeStorage();
    const cache = createGameCache(storage);
    const requestUrl = "https://espn.test/scoreboard?dates=20261031";

    await cache.saveScoreboard("nba", requestUrl, [liveEvent, finalEvent], 100);

    expect(await cache.getScoreboard("nba", requestUrl, 101)).toEqual([
      finalEvent,
    ]);
    expect(await cache.getScoreboard("nhl", requestUrl, 101)).toBeNull();
    expect(
      await cache.getScoreboard("nba", `${requestUrl}&group=1`, 101),
    ).toBeNull();
    expect(storage.put).toHaveBeenCalledOnce();
  });

  it("persists completed summaries only", async () => {
    const { storage } = makeStorage();
    const cache = createGameCache(storage);

    await cache.saveSummary("nba", "event-1", liveSummary, 100);
    expect(await cache.getSummary("nba", "event-1", 101)).toBeNull();
    expect(storage.put).not.toHaveBeenCalled();

    await cache.saveSummary("nba", "event-1", finalSummary, 200);
    expect(await cache.getSummary("nba", "event-1", 201)).toEqual(finalSummary);
    expect(await cache.getSummary("nhl", "event-1", 201)).toBeNull();
  });

  it("returns cache entries until the seven-day TTL and deletes them at expiry", async () => {
    const { storage } = makeStorage();
    const cache = createGameCache(storage);
    await cache.saveScoreboard("nba", "url", [finalEvent], 100);

    expect(
      await cache.getScoreboard("nba", "url", 100 + GAME_CACHE_TTL_MS - 1),
    ).toEqual([finalEvent]);
    expect(
      await cache.getScoreboard("nba", "url", 100 + GAME_CACHE_TTL_MS),
    ).toBeNull();
    expect(storage.delete).toHaveBeenCalledOnce();
  });

  it("ignores malformed records and tolerates unavailable or failing storage", async () => {
    const malformedStorage = makeStorage([
      {
        key: "scoreboard:nba:url",
        savedAt: Number.NaN,
        value: [finalEvent],
      },
    ]);
    const cache = createGameCache(malformedStorage.storage);
    expect(await cache.getScoreboard("nba", "url", 100)).toBeNull();

    const failingStorage: GameCacheStorage = {
      get: vi.fn(async () => {
        throw new Error("blocked");
      }),
      put: vi.fn(async () => {
        throw new Error("quota");
      }),
      delete: vi.fn(async () => {
        throw new Error("blocked");
      }),
    };
    const unavailableCache = createGameCache(null);
    const failingCache = createGameCache(failingStorage);

    await expect(
      unavailableCache.getScoreboard("nba", "url"),
    ).resolves.toBeNull();
    await expect(
      unavailableCache.saveScoreboard("nba", "url", [finalEvent]),
    ).resolves.toBeUndefined();
    await expect(failingCache.getScoreboard("nba", "url")).resolves.toBeNull();
    await expect(
      failingCache.saveScoreboard("nba", "url", [finalEvent]),
    ).resolves.toBeUndefined();
  });
});
