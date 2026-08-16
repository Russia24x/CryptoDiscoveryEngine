import { NextResponse } from "next/server";
import { getHistoricalOHLCV } from "@/providers/coinpaprika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/price-history-batch
// Body: { symbols: ["BTC","ETH","SOL",...], days: 7 }
// Returns: { sparklines: { BTC: { changePct: 2.5, closes: [...] }, ... } }
//
// Fetches short price history (default 7d) for multiple symbols in parallel.
// Designed for the discovery table's mini price sparklines — lightweight
// payload (just closes + changePct), cached 5 min on the client.
//
// Limits: max 30 symbols per request to avoid CoinPaprika rate limits.
// Assets not on CoinPaprika are silently skipped (no error in response).

const MAX_SYMBOLS = 30;
const DEFAULT_DAYS = 7;

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

  // Fetch all in parallel — each getHistoricalOHLCV call is independent.
  // CoinPaprika free tier allows ~20k calls/month, so 30 parallel calls
  // per scan is acceptable.
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const { candles } = await getHistoricalOHLCV(sym, { days, interval: "1d" }, ctx);
        if (candles.length < 2) return { sym, data: null };
        const closes = candles.map((c) => c.price);
        const first = closes[0];
        const last = closes[closes.length - 1];
        const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
        // Downsample to max 20 points for the sparkline (7d = ~7 points anyway).
        const step = Math.max(1, Math.floor(closes.length / 20));
        const sampled = closes.filter((_, i) => i % step === 0);
        return { sym, data: { changePct, closes: sampled } };
      } catch {
        return { sym, data: null };
      }
    }),
  );

  const sparklines: Record<string, { changePct: number; closes: number[] } | null> = {};
  for (const { sym, data } of results) {
    sparklines[sym] = data;
  }

  return NextResponse.json({ sparklines });
}
