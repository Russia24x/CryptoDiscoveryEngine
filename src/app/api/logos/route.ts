import { NextResponse } from "next/server";
import { safeJsonFetch } from "@/providers/types";
import { isTripped, trip, isRateLimitStatus } from "@/lib/circuit-breaker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/logos?symbols=BTC,ETH,BNB
// Returns a map of symbol → logo URL.
//
// PERFORMANCE: previously this endpoint made TWO CoinPaprika calls per symbol
// (search + coin detail) — up to 40 calls per request against a 60 req/HOUR
// free tier. Now it fetches the full coin index ONCE per hour
// (GET /v1/coins — 1 call) and builds logo URLs from the predictable
// static.coinpaprika.com CDN pattern: https://static.coinpaprika.com/coin/{id}/logo.png
// Circuit-breaker aware; serves the stale index while CoinPaprika is tripped.

interface IndexEntry { id: string; symbol: string; is_active: boolean; rank: number }

const INDEX_TTL_MS = 60 * 60 * 1000; // 1 hour
const INDEX_STALE_MAX_MS = 24 * 60 * 60 * 1000; // serve stale index up to 24h while breaker is tripped

let indexCache: { bySymbol: Map<string, string>; fetchedAt: number } | null = null;

async function getCoinsIndex(): Promise<Map<string, string> | null> {
  const now = Date.now();
  if (indexCache && now - indexCache.fetchedAt < INDEX_TTL_MS) {
    return indexCache.bySymbol;
  }

  // Breaker tripped → serve stale index if it's still reasonably fresh.
  if (isTripped("coinpaprika")) {
    if (indexCache && now - indexCache.fetchedAt < INDEX_STALE_MAX_MS) {
      return indexCache.bySymbol;
    }
    return null;
  }

  const data = await safeJsonFetch<IndexEntry[]>(
    "https://api.coinpaprika.com/v1/coins",
    { fetch },
  );

  if (safeJsonFetch.lastRateLimitStatus !== null && isRateLimitStatus(safeJsonFetch.lastRateLimitStatus)) {
    trip("coinpaprika");
    // Serve stale rather than failing the whole request.
    if (indexCache && now - indexCache.fetchedAt < INDEX_STALE_MAX_MS) {
      return indexCache.bySymbol;
    }
    return null;
  }

  if (!Array.isArray(data)) {
    return indexCache?.bySymbol ?? null; // network failure → stale-if-error
  }

  // Build symbol → id map in ONE pass. Duplicate symbols exist (wrapped/dead
  // coins); prefer ACTIVE coins with the LOWEST rank (rank 1 = bitcoin).
  // Score: active coins beat inactive; ranked (lower) rank beats higher/unranked.
  const score = (c: IndexEntry): number =>
    (c.is_active ? 10_000_000 : 0) - (c.rank > 0 ? c.rank : 1_000_000);
  const best = new Map<string, IndexEntry>();
  for (const c of data) {
    if (!c?.id || !c?.symbol) continue;
    const sym = c.symbol.toUpperCase();
    const cur = best.get(sym);
    if (!cur || score(c) > score(cur)) best.set(sym, c);
  }
  const bySymbol = new Map<string, string>(
    Array.from(best.entries()).map(([sym, c]): [string, string] => [sym, c.id]),
  );

  indexCache = { bySymbol, fetchedAt: now };
  return bySymbol;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ logos: {} });
  }

  // No per-symbol API calls anymore — the 20-symbol cap is obsolete.
  const index = await getCoinsIndex();

  const logos: Record<string, string | null> = {};
  for (const sym of symbols) {
    const id = index?.get(sym);
    logos[sym] = id ? `https://static.coinpaprika.com/coin/${id}/logo.png` : null;
  }

  return NextResponse.json({ logos });
}
