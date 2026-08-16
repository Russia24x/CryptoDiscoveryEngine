/**
 * CoinPaprika provider — free, key-less, 25k calls/month.
 *
 * Provides: coin metadata (description, website, social links, GitHub),
 * price, volume, market_cap, supply, beta, percent changes, events.
 *
 * Alternative to CoinGecko (which rate-limits at 429 frequently).
 * Also provides OHLCV for non-Binance assets (recent data only on free tier).
 *
 * Endpoints:
 * - /coins/{id} — detailed coin info (description, links, social, GitHub)
 * - /tickers/{id} — price, volume, market_cap, supply, changes
 * - /search?q=SYMBOL — find coin ID by symbol
 * - /coins/{id}/events — upcoming events (catalysts)
 * - /tickers/{id}/historical — OHLCV (free tier: recent only)
 */
import { safeJsonFetch } from "./types";

export interface CoinPaprikaCoin {
  id: string;            // e.g. "btc-bitcoin"
  name: string;
  symbol: string;
  rank: number;
  description: string;
  open_source: boolean;
  hardware_wallet: boolean;
  logo: string;          // e.g. "https://static.coinpaprika.com/coin/bnb-bnb/logo.png"
  links: {
    website: string[];
    explorer: string[];
    facebook: string[];
    reddit: string[];
    source_code: string[];  // GitHub
    youtube: string[];
  };
  parent: string | null;
  whitepaper: { link: string; thumbnail: string } | null;
}

export interface CoinPaprikaTicker {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  total_supply: number;
  max_supply: number;
  beta_value: number;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      percent_change_1h: number;
      ath_price: number;
      ath_date: string;
      atl_price: number;
      atl_date: string;
    };
  };
}

export interface CoinPaprikaEvent {
  id: string;
  date: string;
  date_to: string | null;
  name: string;
  description: string;
  is_conference: boolean;
  link: string;
  proof_image_link: string;
}

const PAPRIKA_BASE = "https://api.coinpaprika.com/v1";

// In-memory cache for coin IDs (symbol → paprika_id)
const idCache = new Map<string, string>();

/** Search CoinPaprika for a coin by symbol. Returns the paprika ID. */
export async function findCoinId(
  symbol: string,
  ctx: { fetch?: typeof fetch } = {},
): Promise<string | null> {
  const sym = symbol.toUpperCase();
  if (idCache.has(sym)) return idCache.get(sym)!;

  const data = await safeJsonFetch<{ currencies: Array<{ id: string; symbol: string; name: string }> }>(
    `${PAPRIKA_BASE}/search?q=${encodeURIComponent(sym)}&limit=5`,
    ctx,
  );
  if (!data?.currencies) return null;

  // Find exact symbol match (case-insensitive)
  const match = data.currencies.find(
    (c) => c.symbol.toUpperCase() === sym,
  );
  if (match) {
    idCache.set(sym, match.id);
    return match.id;
  }
  return null;
}

/** Get detailed coin info (description, website, social links, GitHub). */
export async function getCoinInfo(
  paprikaId: string,
  ctx: { fetch?: typeof fetch } = {},
): Promise<CoinPaprikaCoin | null> {
  return safeJsonFetch<CoinPaprikaCoin>(
    `${PAPRIKA_BASE}/coins/${paprikaId}`,
    ctx,
  );
}

/** Get ticker data (price, volume, market_cap, supply, changes). */
export async function getTicker(
  paprikaId: string,
  ctx: { fetch?: typeof fetch } = {},
): Promise<CoinPaprikaTicker | null> {
  return safeJsonFetch<CoinPaprikaTicker>(
    `${PAPRIKA_BASE}/tickers/${paprikaId}`,
    ctx,
  );
}

/** Get upcoming events/catalysts for a coin. */
export async function getEvents(
  paprikaId: string,
  ctx: { fetch?: typeof fetch } = {},
): Promise<CoinPaprikaEvent[]> {
  const data = await safeJsonFetch<CoinPaprikaEvent[]>(
    `${PAPRIKA_BASE}/coins/${paprikaId}/events`,
    ctx,
  );
  return data ?? [];
}

/** Combined: search by symbol → get coin info + ticker in parallel. */
export async function getFullCoinData(
  symbol: string,
  ctx: { fetch?: typeof fetch } = {},
): Promise<{
  coin: CoinPaprikaCoin | null;
  ticker: CoinPaprikaTicker | null;
  events: CoinPaprikaEvent[];
} | null> {
  const paprikaId = await findCoinId(symbol, ctx);
  if (!paprikaId) return null;

  const [coin, ticker, events] = await Promise.all([
    getCoinInfo(paprikaId, ctx),
    getTicker(paprikaId, ctx),
    getEvents(paprikaId, ctx),
  ]);

  if (!coin && !ticker) return null;
  return { coin, ticker, events };
}

/**
 * Historical price point returned by CoinPaprika's /tickers/{id}/historical
 * endpoint (free tier). NOTE: the free tier returns a single `price` per
 * interval (daily close), NOT full OHLC candles. The `price_open`/`price_high`
 * /`price_low`/`price_close` fields are only available on paid plans.
 */
export interface CoinPaprikaCandle {
  timestamp: string;       // ISO timestamp (e.g. "2026-08-12T00:00:00Z")
  price: number;           // daily close price (USD)
  volume_24h: number;      // 24h trade volume
  market_cap: number;       // market cap at close
}

/**
 * Fetch historical price history for a coin.
 *
 * Free-tier limit: only allows recent data (start date can't be in the past
 * beyond a threshold). We use interval=1d for charting — perfect for the
 * 7d/30d/90d/1y timeframes exposed by the PriceChartCard.
 *
 * Returns points oldest→newest (chart-friendly).
 */
export async function getHistoricalOHLCV(
  symbol: string,
  opts: { days?: number; interval?: "1d" | "1h" } = {},
  ctx: { fetch?: typeof fetch } = {},
): Promise<{ candles: CoinPaprikaCandle[]; paprikaId: string }> {
  const days = Math.min(opts.days ?? 30, 365);
  const interval = opts.interval ?? "1d";
  const paprikaId = await findCoinId(symbol, ctx);
  if (!paprikaId) return { candles: [], paprikaId: "" };

  // CoinPaprika historical endpoint. start = now - days, end = now.
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  const url = `${PAPRIKA_BASE}/tickers/${paprikaId}/historical?start=${encodeURIComponent(fmt(start))}&end=${encodeURIComponent(fmt(end))}&interval=${interval}`;

  const data = await safeJsonFetch<CoinPaprikaCandle[] | null>(url, ctx);
  // Sort oldest→newest for charting.
  const candles = (data ?? []).sort(
    (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp),
  );
  return { candles, paprikaId };
}
