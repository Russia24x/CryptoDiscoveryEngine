import { NextResponse } from "next/server";
import { analyzeTechnical, type Candle } from "@/engine/technical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/technical/[symbol]?interval=1d&limit=365
// Fetches historical OHLCV from Binance, runs full technical analysis.
// Falls back gracefully if the asset is not listed on Binance.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  // Whitelist interval — it is interpolated into an external URL, so anything
  // not in this set is rejected (prevents parameter injection / NaN / garbage).
  const ALLOWED_INTERVALS = new Set(["1h", "4h", "1d", "1w"]);
  const intervalParam = url.searchParams.get("interval") ?? "1d";
  if (!ALLOWED_INTERVALS.has(intervalParam)) {
    return NextResponse.json(
      { error: "invalid_interval", message: "interval must be one of: 1h, 4h, 1d, 1w" },
      { status: 400 },
    );
  }
  const interval = intervalParam;
  // Validate limit as a finite integer in [1, 1000] — Number("abc") is NaN and
  // NaN silently propagates into the upstream URL.
  const limitRaw = Number(url.searchParams.get("limit") ?? "365");
  if (!Number.isFinite(limitRaw) || limitRaw < 1) {
    return NextResponse.json(
      { error: "invalid_limit", message: "limit must be an integer between 1 and 1000" },
      { status: 400 },
    );
  }
  const limit = Math.min(Math.floor(limitRaw), 1000);
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!sym) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }

  // Try Binance first (primary source for OHLCV)
  const pair = `${sym}USDT`;
  const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

  try {
    const res = await fetch(klinesUrl, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      // Binance doesn't have this pair — return a clear message, not an error
      if (res.status === 400) {
        return NextResponse.json(
          {
            error: "not_on_binance",
            message: `${sym} is not listed on Binance. Technical analysis requires OHLCV data which is only available for Binance-listed assets.`,
          },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: `Binance API returned ${res.status}` },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as unknown[][];

    // Parse klines: [time, open, high, low, close, volume, ...]
    const candles: Candle[] = raw.map((k) => ({
      time: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    if (candles.length < 50) {
      return NextResponse.json(
        {
          error: "insufficient_data",
          message: `Only ${candles.length} candles available. Need at least 50 for technical analysis.`,
        },
        { status: 422 },
      );
    }

    // Run full technical analysis
    const analysis = analyzeTechnical(sym, candles);

    return NextResponse.json({
      symbol: sym,
      candles: candles.length,
      analysis,
    });
  } catch (e) {
    // Log details server-side only — never leak internals (paths, upstream errors) to clients.
    console.error("[technical] fetch failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "fetch_failed", message: "Failed to fetch OHLCV data from upstream provider." },
      { status: 500 },
    );
  }
}
