import { NextResponse } from "next/server";
import { getHistoricalOHLCV } from "@/providers/coinpaprika";
import { getCoingeckoHistorical } from "@/providers/coingecko";
import { getCached, setCached, priceCacheKey } from "@/lib/price-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/price-history-batch
// Body: { symbols: ["BTC","ETH","SOL",...], days: 7 }
// Returns: { sparklines: { BTC: { changePct: 2.5, closes: [...] }, ... } }
//
// Fetches short price history (default 7d) for multiple symbols in parallel.
// Designed for the discovery table's mini price sparklines.
//
// Provider chain: CoinPaprika (primary) → CoinGecko (fallback).
// CoinPaprika free tier: 60 req/hour. CoinGecko free tier: ~50 req/min.
// When CoinPaprika returns no data (rate-limited or not indexed), the
// endpoint falls back to CoinGecko automatically.
//
// Server-side cache: each (symbol, days) pair is cached for 10 min in-memory.
// This means multiple users / page refreshes share the same API calls.

const MAX_SYMBOLS = 30;
const DEFAULT_DAYS = 7;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawSymbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  const days = Math.min(Math.max(Number(body.days ?? DEFAULT_DAYS), 1), 30);
  const ctx = { fetch };

  if (rawSymbols.length === 0) {
    return NextResponse.json({ sparklines: {} });
  }
  if (rawSymbols.length > MAX_SYMBOLS) {
    return NextResponse.json(
      { error: `max ${MAX_SYMBOLS} symbols` },
      { status: 400 },
    );
  }

  const symbols = rawSymbols.map((s) => String(s).toUpperCase()).slice(0, MAX_SYMBOLS);

  // Check cache for each symbol. Only fetch uncached symbols.
  const sparklines: Record<string, { changePct: number; closes: number[] } | null> = {};
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const key = priceCacheKey(sym, days);
    const cached = getCached<{ changePct: number; closes: number[] } | null>(key);
    if (cached !== undefined) {
      sparklines[sym] = cached;
    } else {
      toFetch.push(sym);
    }
  }

  // Fetch only uncached symbols. Provider chain: CoinPaprika → CoinGecko.
  if (toFetch.length > 0) {
    const results = await Promise.all(
      toFetch.map(async (sym) => {
        try {
          // Try CoinPaprika first
          const { candles } = await getHistoricalOHLCV(sym, { days, interval: "1d" }, ctx);
          let closes: number[] = [];

          if (candles.length >= 2) {
            closes = candles.map((c) => c.price);
          } else {
            // CoinPaprika returned no data (rate-limited or not indexed).
            // Fall back to CoinGecko.
            closes = await getCoingeckoHistorical(sym, days, ctx);
          }

          if (closes.length < 2) {
            return { sym, data: null };
          }

          const first = closes[0];
          const last = closes[closes.length - 1];
          const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
          // Downsample to max 20 points for the sparkline.
          const step = Math.max(1, Math.floor(closes.length / 20));
          const sampled = closes.filter((_, i) => i % step === 0);
          return { sym, data: { changePct, closes: sampled } };
        } catch {
          return { sym, data: null };
        }
      }),
    );

    // Store fetched results in cache + response.
    for (const { sym, data } of results) {
      setCached(priceCacheKey(sym, days), data, CACHE_TTL_MS);
      sparklines[sym] = data;
    }
  }

  return NextResponse.json({ sparklines });
}
