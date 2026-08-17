/**
 * Binance provider — free, key-less, REAL-TIME.
 *
 * Provides: real-time prices, 24h volume, price change, market cap (derived).
 * This is the ONLY real-time provider — all others are on-demand (fetch per scan).
 *
 * Endpoints:
 * - /api/v3/ticker/24hr — 24h ticker for all symbols (3684 tickers, ~300KB)
 * - /api/v3/exchangeInfo — exchange info (USDT pairs, status)
 *
 * Rate limits: 1200 weight/min. The /ticker/24hr (all) costs 80 weight.
 * We cache for 10 seconds to stay well within limits.
 */
import {
  type DataProvider,
  type ProviderContext,
  type ProtocolSummary,
  type ProtocolDetail,
  safeJsonFetch,
} from "./types";

interface BinanceTicker {
  symbol: string;      // e.g. "BTCUSDT"
  lastPrice: string;
  priceChangePercent: string;
  volume: string;       // base asset volume
  quoteVolume: string;  // 24h volume in USDT
  highPrice: string;
  lowPrice: string;
}

interface BinanceExchangeSymbol {
  symbol: string;       // e.g. "BTCUSDT"
  status: string;
  baseAsset: string;    // e.g. "BTC"
  quoteAsset: string;   // e.g. "USDT"
}

// In-memory cache for real-time ticker data (10s TTL).
interface CachedTickers {
  tickers: Map<string, BinanceTicker>; // keyed by baseAsset (e.g. "BTC")
  fetchedAt: number;
}
const TICKER_CACHE: CachedTickers = { tickers: new Map(), fetchedAt: 0 };
const TICKER_TTL_MS = 10_000; // 10 seconds — real-time-ish without rate-limit risk

async function fetchAllTickers(ctx: ProviderContext): Promise<Map<string, BinanceTicker>> {
  const now = Date.now();
  if (TICKER_CACHE.tickers.size > 0 && now - TICKER_CACHE.fetchedAt < TICKER_TTL_MS) {
    return TICKER_CACHE.tickers;
  }

  // Fetch all 24hr tickers in one call (costs 80 weight, well within 1200/min)
  const data = await safeJsonFetch<BinanceTicker[]>(
    "https://api.binance.com/api/v3/ticker/24hr",
    ctx,
  );
  if (!data) return TICKER_CACHE.tickers; // return stale cache if fetch fails

  // Fetch exchange info to know which are USDT pairs
  const exchangeInfo = await safeJsonFetch<{ symbols: BinanceExchangeSymbol[] }>(
    "https://api.binance.com/api/v3/exchangeInfo",
    ctx,
  );

  // Build a set of USDT trading pairs
  const usdtBases = new Set<string>();
  if (exchangeInfo?.symbols) {
    for (const s of exchangeInfo.symbols) {
      if (s.quoteAsset === "USDT" && s.status === "TRADING") {
        usdtBases.add(s.baseAsset);
      }
    }
  }

  // Build ticker map keyed by baseAsset
  const tickerMap = new Map<string, BinanceTicker>();
  for (const t of data) {
    // Only keep USDT pairs (symbol ends with "USDT")
    if (t.symbol.endsWith("USDT")) {
      const base = t.symbol.slice(0, -4); // strip "USDT"
      if (usdtBases.size === 0 || usdtBases.has(base)) {
        tickerMap.set(base, t);
      }
    }
  }

  TICKER_CACHE.tickers = tickerMap;
  TICKER_CACHE.fetchedAt = now;
  return tickerMap;
}

export const binanceProvider: DataProvider = {
  meta: {
    slug: "binance",
    name: "Binance (Real-Time)",
    baseUrl: "https://api.binance.com",
    authMode: "none",
    freeTier: true,
    tier: "free",
    categories: ["market", "realtime"],
    priority: 5, // highest priority — real-time
  },
  isAvailable(_: ProviderContext) {
    return true; // key-less
  },
  async listProtocols(ctx: ProviderContext): Promise<ProtocolSummary[]> {
    const tickers = await fetchAllTickers(ctx);
    const summaries: ProtocolSummary[] = [];
    for (const [base, t] of tickers) {
      const price = parseFloat(t.lastPrice);
      const volume24h = parseFloat(t.quoteVolume); // USDT volume
      if (price > 0 && volume24h > 10000) { // skip dust pairs
        summaries.push({
          symbol: base,
          name: base, // Binance doesn't have full names, use symbol
          mc: price * parseFloat(t.volume), // rough market cap proxy (price × circulating volume)
          // Note: this isn't true market cap, but Binance doesn't provide it.
          // DeFiLlama/CoinGecko provide better MC data when available.
          price,
          volume24h,
          change24h: parseFloat(t.priceChangePercent),
        });
      }
    }
    return summaries;
  },
  async getProtocol(
    symbol: string,
    ctx: ProviderContext,
  ): Promise<ProtocolDetail | null> {
    const tickers = await fetchAllTickers(ctx);
    const t = tickers.get(symbol.toUpperCase());
    if (!t) return null;
    const price = parseFloat(t.lastPrice);
    const volume24h = parseFloat(t.quoteVolume);
    return {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      marketCap: price * parseFloat(t.volume),
      fdv: price * parseFloat(t.volume),
      float: price * parseFloat(t.volume),
      // Binance provides price + volume only — no TVL/fees/revenue
      pr: 0, pc: 0, tc: 0, gea: 0,
      accrualKind: "fee",
    };
  },
  /** Get real-time price for a symbol (used for live price display). */
  async getPrice(symbol: string, ctx: ProviderContext): Promise<{ price: number; change24h: number; volume24h: number } | null> {
    const tickers = await fetchAllTickers(ctx);
    const t = tickers.get(symbol.toUpperCase());
    if (!t) return null;
    return {
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      volume24h: parseFloat(t.quoteVolume),
    };
  },
};

/**
 * Fetch historical daily closes from Binance klines API.
 *
 * Binance rate limit: 1200 weight/min. Each /klines call costs 2 weight.
 * This is 600x higher than CoinPaprika's 60 req/hour — effectively unlimited
 * for our use case.
 *
 * Used as the FINAL fallback in the provider chain:
 * CoinPaprika → CoinGecko → Binance (for Binance-listed assets only).
 *
 * Returns an array of close prices, oldest→newest. Empty array on failure
 * or if the symbol isn't listed on Binance.
 */
export async function getBinanceHistorical(
  symbol: string,
  days: number,
  ctx: { fetch?: typeof fetch } = {},
): Promise<number[]> {
  const sym = symbol.toUpperCase();
  const pair = `${sym}USDT`;

  // Binance klines API: /api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7
  const limit = Math.min(Math.max(days, 1), 365);
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=${limit}`;

  try {
    const f = ctx.fetch ?? fetch;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await f(url, { signal: ctrl.signal });
      if (!res.ok) return [];
      const raw = (await res.json()) as unknown[][];
      // klines format: [time, open, high, low, close, volume, ...]
      // Index 4 = close price (string)
      return raw.map((k) => parseFloat(k[4] as string)).filter((p) => !isNaN(p) && p > 0);
    } finally {
      clearTimeout(t);
    }
  } catch {
    return [];
  }
}
