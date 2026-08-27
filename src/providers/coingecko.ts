/**
 * CoinGecko provider — free public endpoints (no key required).
 * Provides: market cap, FDV, circulating supply, price, volume.
 *
 * Note: CoinGecko's free public API may rate-limit. We keep requests
 * minimal and cache aggressively at the app layer.
 */
import {
  type DataProvider,
  type ProviderContext,
  type ProtocolSummary,
  type ProtocolDetail,
  safeJsonFetch,
} from "./types";
import { isTripped, trip } from "@/lib/circuit-breaker";

const GECKO_CIRCUIT = "coingecko";

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number;
  circulating_supply: number;
  total_volume: number;
  price_change_percentage_24h?: number;
}

export const coingeckoProvider: DataProvider = {
  meta: {
    slug: "coingecko",
    name: "CoinGecko (Public)",
    baseUrl: "https://api.coingecko.com",
    authMode: "none",
    freeTier: true,
    tier: "free",
    categories: ["market", "supply"],
    priority: 20,
  },
  isAvailable() {
    return true;
  },
  async listProtocols(ctx: ProviderContext): Promise<ProtocolSummary[]> {
    const data = await safeJsonFetch<CGMarket[]>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false",
      ctx,
    );
    if (!data) return [];
    return data.map<ProtocolSummary>((m) => ({
      symbol: (m.symbol || "").toUpperCase(),
      name: m.name,
      coingeckoId: m.id,
      mc: m.market_cap,
      fdv: m.fully_diluted_valuation ?? m.market_cap,
    }));
  },
  async getProtocol(
    symbol: string,
    ctx: ProviderContext,
  ): Promise<ProtocolDetail | null> {
    const list = await this.listProtocols(ctx);
    const hit = list.find(
      (p) => p.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    if (!hit) return null;
    const m = await safeJsonFetch<CGMarket[]>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
        encodeURIComponent(hit.coingeckoId || "") +
        "&sparkline=false",
      ctx,
    );
    const detail = m?.[0];
    return {
      ...hit,
      mc: detail?.market_cap ?? hit.mc,
      fdv: detail?.fully_diluted_valuation ?? hit.fdv,
      float: detail?.circulating_supply
        ? detail.circulating_supply * (detail.current_price || 0)
        : hit.mc,
    };
  },
};

/**
 * Fallback historical price fetcher using CoinGecko's free public API.
 *
 * CoinGecko's /coins/{id}/market_chart endpoint returns hourly prices for
 * up to 90 days, and daily prices for >90 days. The free tier allows
 * ~50 calls/min (much higher than CoinPaprika's 60/hour).
 *
 * Used as a fallback when CoinPaprika is rate-limited (402 Payment Required).
 *
 * Returns an array of price values, oldest→newest. Empty array on failure.
 */

// In-memory cache for CoinGecko coin IDs (symbol → coinId).
// Avoids repeated /search calls for the same symbol.
// A null value means "searched but not found" — don't retry.
// Entries expire after 1 hour to allow re-discovery of delisted/newly-listed assets.
interface GeckoIdEntry {
  coinId: string | null;
  expiresAt: number; // epoch ms
}
const GECKO_ID_TTL_MS = 60 * 60 * 1000; // 1 hour
const geckoIdCache = new Map<string, GeckoIdEntry>();

export async function getCoingeckoHistorical(
  symbol: string,
  days: number,
  ctx: { fetch?: typeof fetch } = {},
): Promise<number[]> {
  const sym = symbol.toUpperCase();

  // Circuit breaker: skip CoinGecko entirely if recently rate-limited.
  if (isTripped(GECKO_CIRCUIT)) return [];

  // Check ID cache first (with TTL expiry)
  let coinId: string | null | undefined;
  const cached = geckoIdCache.get(sym);
  if (cached && Date.now() < cached.expiresAt) {
    coinId = cached.coinId;
  } else {
    // Not cached or expired — search for the coin ID
    // Reset the rate-limit side-channel before the fetch.
    safeJsonFetch.lastRateLimitStatus = null;

    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`;
    const search = await safeJsonFetch<{ coins: Array<{ id: string; symbol: string; market_cap_rank: number }> }>(searchUrl, ctx);

    // If the search hit a rate limit, trip the circuit for 5 minutes.
    if (safeJsonFetch.lastRateLimitStatus !== null) {
      trip(GECKO_CIRCUIT, 5 * 60 * 1000);
      return [];
    }

    if (!search?.coins?.length) {
      geckoIdCache.set(sym, { coinId: null, expiresAt: Date.now() + GECKO_ID_TTL_MS });
      return [];
    }

    // Find exact symbol match, prefer highest market cap rank.
    const matches = search.coins.filter(
      (c) => c.symbol.toUpperCase() === sym,
    );
    if (matches.length === 0) {
      geckoIdCache.set(sym, { coinId: null, expiresAt: Date.now() + GECKO_ID_TTL_MS });
      return [];
    }

    // Sort by market cap rank (lower = better, nulls last).
    matches.sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity));
    coinId = matches[0].id;
    geckoIdCache.set(sym, { coinId, expiresAt: Date.now() + GECKO_ID_TTL_MS });
  }

  // coinId is null if previously searched and not found
  if (!coinId) return [];

  // Reset the rate-limit side-channel before the chart fetch.
  safeJsonFetch.lastRateLimitStatus = null;

  // Fetch historical prices. interval=daily for >1 day.
  const chartUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const chart = await safeJsonFetch<{ prices: [number, number][] }>(chartUrl, ctx);

  // If the chart fetch hit a rate limit, trip the circuit for 5 minutes.
  if (safeJsonFetch.lastRateLimitStatus !== null) {
    trip(GECKO_CIRCUIT, 5 * 60 * 1000);
    return [];
  }

  if (!chart?.prices?.length) return [];

  // Extract just the price values (drop timestamps).
  return chart.prices.map((p) => p[1]);
}
