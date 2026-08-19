import { NextResponse } from "next/server";
import { getHistoricalOHLCV, type CoinPaprikaCandle } from "@/providers/coinpaprika";
import { getCached, setCached, priceCacheKey } from "@/lib/price-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/price-history/[symbol]?days=30
// Returns historical OHLCV candles for the price chart in the detail view.
// Works for ALL assets (CoinPaprika-backed), not just Binance-listed ones.
// Uses the server-side price cache (10 min TTL) to reduce CoinPaprika calls.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "30"), 1), 365);
  const sym = symbol.toUpperCase();
  const ctx = { fetch };

  // Check cache first (for the slim sparkline format). The detail view's
  // full chart needs the complete candle array, so we only cache the slim
  // format used by the batch endpoint. For the detail view, we fetch fresh
  // data if days > 7 (the batch endpoint only caches 7d data).
  if (days <= 7) {
    const cached = getCached<{ changePct: number; closes: number[] } | null>(priceCacheKey(sym, days));
    if (cached !== undefined && cached) {
      // Reconstruct full candle array from cached closes for chart compatibility
      const candles = cached.closes.map((c, i) => ({
        t: new Date(Date.now() - (cached.closes.length - i) * 86400000).toISOString(),
        o: c, h: c, l: c, c: c, v: 0,
      }));
      return NextResponse.json({
        symbol: sym,
        days,
        candles,
        summary: {
          high: Math.max(...cached.closes),
          low: Math.min(...cached.closes),
          first: cached.closes[0],
          last: cached.closes[cached.closes.length - 1],
          changePct: cached.changePct,
          count: cached.closes.length,
        },
      });
    }
  }

  try {
    const { candles, paprikaId } = await getHistoricalOHLCV(
      sym,
      { days, interval: "1d" },
      ctx,
    );

    if (candles.length === 0) {
      return NextResponse.json(
        {
          symbol: sym,
          error: "no_history",
          message: paprikaId
            ? `CoinPaprika returned no historical candles for ${sym}.`
            : `${sym} is not indexed by CoinPaprika. Price history unavailable.`,
          candles: [],
        },
        { status: 404 },
      );
    }

    // Slim the payload — only send what the chart needs.
    // CoinPaprika free tier returns a single `price` per day (no OHLC),
    // so we set o/h/l/c all to that price for chart compatibility.
    const slim: Array<{
      t: string;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }> = candles.map((c: CoinPaprikaCandle) => ({
      t: c.timestamp,
      o: c.price,
      h: c.price,
      l: c.price,
      c: c.price,
      v: c.volume_24h,
    }));

    // Compute summary stats for the chart header badges.
    const closes = slim.map((c) => c.c);
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const first = closes[0] ?? 0;
    const last = closes[closes.length - 1] ?? 0;
    const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

    // Cache the slim format for 7d requests (used by batch endpoint too)
    if (days <= 7) {
      setCached(priceCacheKey(sym, days), { changePct, closes }, 10 * 60 * 1000);
    }

    return NextResponse.json({
      symbol: sym,
      days,
      candles: slim,
      summary: {
        high,
        low,
        first,
        last,
        changePct,
        count: slim.length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { symbol: sym, error: "fetch_failed", message: msg, candles: [] },
      { status: 500 },
    );
  }
}
