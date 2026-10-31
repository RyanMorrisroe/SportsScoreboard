export const GAME_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface GameCacheRecord {
  key: string;
  savedAt: number;
  value: unknown;
}

export interface GameCacheStorage {
  get(key: string): Promise<GameCacheRecord | null>;
  put(record: GameCacheRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CachedGameData {
  value: unknown;
  savedAt: number;
}

export interface GameCache {
  getResponse(url: string, now?: number): Promise<CachedGameData | null>;
  saveResponse(url: string, value: unknown, now?: number): Promise<void>;
  getScoreboard(
    league: string,
    requestUrl: string,
    now?: number,
  ): Promise<unknown[] | null>;
  saveScoreboard(
    league: string,
    requestUrl: string,
    events: unknown[],
    now?: number,
  ): Promise<void>;
  getSummary(
    league: string,
    eventId: string,
    now?: number,
  ): Promise<unknown | null>;
  saveSummary(
    league: string,
    eventId: string,
    summary: unknown,
    now?: number,
  ): Promise<void>;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function isFinalEvent(value: unknown): boolean {
  return (
    String(
      asObject(asObject(asObject(value).status).type).state,
    ).toLowerCase() === "post"
  );
}

function isFinalSummary(value: unknown): boolean {
  const raw = asObject(value);
  const header = asObject(raw.header);
  const competition = Array.isArray(header.competitions)
    ? asObject(header.competitions[0])
    : {};
  const status = asObject(asObject(competition.status).type).state;
  return String(status).toLowerCase() === "post";
}

function scoreboardKey(league: string, requestUrl: string): string {
  return `scoreboard:${encodeURIComponent(league)}:${encodeURIComponent(requestUrl)}`;
}

function summaryKey(league: string, eventId: string): string {
  return `summary:${encodeURIComponent(league)}:${encodeURIComponent(eventId)}`;
}

function responseKey(url: string): string {
  return `response:${encodeURIComponent(url)}`;
}

function isValidRecord(value: unknown, key: string): value is GameCacheRecord {
  const record = asObject(value);
  return (
    record.key === key &&
    typeof record.savedAt === "number" &&
    Number.isFinite(record.savedAt) &&
    "value" in record
  );
}

export function createGameCache(storage: GameCacheStorage | null): GameCache {
  async function readRecord(
    key: string,
    now: number,
  ): Promise<GameCacheRecord | null> {
    if (!storage) return null;
    try {
      const record = await storage.get(key);
      if (!isValidRecord(record, key)) return null;
      if (now - record.savedAt >= GAME_CACHE_TTL_MS) {
        await storage.delete(key).catch(() => {});
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  async function read(key: string, now: number): Promise<unknown | null> {
    return (await readRecord(key, now))?.value ?? null;
  }

  async function write(
    key: string,
    value: unknown,
    now: number,
  ): Promise<void> {
    if (!storage) return;
    try {
      await storage.put({ key, savedAt: now, value });
    } catch {
      // Cache failures must not affect live network data.
    }
  }

  return {
    async getResponse(url, now = Date.now()) {
      const record = await readRecord(responseKey(url), now);
      return record ? { value: record.value, savedAt: record.savedAt } : null;
    },
    async saveResponse(url, value, now = Date.now()) {
      await write(responseKey(url), value, now);
    },
    async getScoreboard(league, requestUrl, now = Date.now()) {
      const value = await read(scoreboardKey(league, requestUrl), now);
      return Array.isArray(value) ? value.filter(isFinalEvent) : null;
    },
    async saveScoreboard(league, requestUrl, events, now = Date.now()) {
      const completedEvents = events.filter(isFinalEvent);
      if (completedEvents.length) {
        await write(scoreboardKey(league, requestUrl), completedEvents, now);
      }
    },
    async getSummary(league, eventId, now = Date.now()) {
      const value = await read(summaryKey(league, eventId), now);
      return value !== null && isFinalSummary(value) ? value : null;
    },
    async saveSummary(league, eventId, summary, now = Date.now()) {
      if (isFinalSummary(summary)) {
        await write(summaryKey(league, eventId), summary, now);
      }
    },
  };
}

const DATABASE_NAME = "sports-scoreboard-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "completed-games";

function openDatabase(factory: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      resolve(database);
    };

    try {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

function createIndexedDbStorage(): GameCacheStorage {
  async function get(key: string): Promise<GameCacheRecord | null> {
    let factory: IDBFactory | undefined;
    try {
      factory = globalThis.indexedDB;
    } catch {
      return null;
    }
    if (!factory) return null;
    const database = await openDatabase(factory);
    if (!database) return null;

    try {
      return await new Promise((resolve) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () =>
          resolve(isValidRecord(request.result, key) ? request.result : null);
        request.onerror = () => resolve(null);
        transaction.onabort = () => resolve(null);
      });
    } catch {
      return null;
    } finally {
      database.close();
    }
  }

  async function mutate(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => void,
  ): Promise<void> {
    let factory: IDBFactory | undefined;
    try {
      factory = globalThis.indexedDB;
    } catch {
      return;
    }
    if (!factory) return;
    const database = await openDatabase(factory);
    if (!database) return;

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        operation(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch {
      // Cache failures must not affect live network data.
    } finally {
      database.close();
    }
  }

  return {
    get,
    put: (record) =>
      mutate("readwrite", (store) => {
        store.put(record);
      }),
    delete: (key) =>
      mutate("readwrite", (store) => {
        store.delete(key);
      }),
  };
}

export const gameCache = createGameCache(createIndexedDbStorage());
