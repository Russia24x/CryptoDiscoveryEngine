/**
 * TTL-based in-memory cache for price history data.
 *
 * CoinPaprika's free tier allows only 60 requests/hour. Without a cache,
 * every page load / scan refresh would re-fetch the same 7d price data,
 * exhausting the limit in ~6 scans.
 *
 * This cache stores price history per (symbol, days) key for a configurable
 * TTL (default 10 min). Subsequent requests for the same key within the TTL
 * are served from memory — no CoinPaprika call needed.
 *
 * The cache is process-scoped (in-memory), so it survives across API calls
 * within the same Next.js dev server process. Multi-instance deployments
 * would need a shared cache (Redis), but for this project's single-process
 * dev server, in-memory is sufficient.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // epoch ms
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min

const cache = new Map<string, CacheEntry<unknown>>();

/** Get a cached value by key, or null if expired/missing. */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Store a value in the cache with the given TTL. */
export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Build a cache key from symbol + days. */
export function priceCacheKey(symbol: string, days: number): string {
  return `price:${symbol.toUpperCase()}:${days}`;
}

/** Clear all cached entries (useful for testing). */
export function clearPriceCache(): void {
  cache.clear();
}
