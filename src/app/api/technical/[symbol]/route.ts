import { NextResponse } from "next/server";
import { analyzeTechnical, type Candle } from "@/engine/technical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/technical/[symbol]?interval=1d&limit=365
// Fetches historical OHLCV from Binance, runs full technical analysis.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  const interval = url.searchParams.get("interval") ?? "1d";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "365"), 1000);

  // Fetch historical OHLCV from Binance
  const pair = `${symbol.toUpperCase()}USDT`;
  const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(klinesUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
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
        { error: "Not enough historical data for analysis" },
        { status: 422 },
      );
    }

    // Run full technical analysis
    const analysis = analyzeTechnical(symbol.toUpperCase(), candles);

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      candles: candles.length,
      analysis,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
