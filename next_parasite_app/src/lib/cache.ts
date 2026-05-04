/**
 * Lightweight in-process TTL cache.
 * Prevents duplicate DB queries when many users hit the same endpoint simultaneously.
 * Under high concurrency, a "request coalescing" pattern is used so only one
 * in-flight fetch runs at a time per key.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Get-or-compute with request coalescing:
 * If many requests arrive simultaneously for the same key, only one
 * DB call is made; all others await the same promise.
 */
export async function cachedQuery<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cached = cacheGet<T>(key);
    if (cached !== undefined) return cached;

    // Coalesce concurrent requests
    if (inFlight.has(key)) {
        return inFlight.get(key) as Promise<T>;
    }

    const promise = fetcher().then((value) => {
        cacheSet(key, value, ttlMs);
        inFlight.delete(key);
        return value;
    }).catch((err) => {
        inFlight.delete(key);
        throw err;
    });

    inFlight.set(key, promise);
    return promise;
}

/** Manual cache invalidation (e.g. after a write) */
export function cacheInvalidate(key: string): void {
    store.delete(key);
    inFlight.delete(key);
}
