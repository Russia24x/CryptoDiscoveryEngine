import { NextResponse } from "next/server";
import { safeJsonFetch } from "@/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/logos?symbols=BTC,ETH,BNB
// Returns a map of symbol → logo URL from CoinPaprika.
// Uses in-memory cache (1 hour TTL) to avoid repeated API calls.
const LOGO_CACHE = new Map<string, string>();
const LOGO_CACHE_TIME = new Map<string, number>();
const LOGO_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols") ?? "";
  const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ logos: {} });
  }

  const logos: Record<string, string | null> = {};
  const now = Date.now();
  const toFetch: string[] = [];

  // Check cache first
  for (const sym of symbols) {
    const cached = LOGO_CACHE.get(sym);
    const cachedTime = LOGO_CACHE_TIME.get(sym);
    if (cached !== undefined && cachedTime && now - cachedTime < LOGO_TTL_MS) {
      logos[sym] = cached || null;
    } else {
      toFetch.push(sym);
    }
  }

  // Fetch missing logos from CoinPaprika (limit 20 per request)
  const fetchList = toFetch.slice(0, 20);
  await Promise.allSettled(
    fetchList.map(async (sym) => {
      try {
        const searchData = await safeJsonFetch<{
          currencies: Array<{ id: string; symbol: string }>;
        }>(`https://api.coinpaprika.com/v1/search/?q=${encodeURIComponent(sym)}`, { fetch });

        if (!searchData?.currencies) {
          logos[sym] = null;
          LOGO_CACHE.set(sym, "");
          LOGO_CACHE_TIME.set(sym, now);
          return;
        }

        const match = searchData.currencies.find(
          (c) => c.symbol.toUpperCase() === sym,
        );
        if (match?.id) {
          const coinData = await safeJsonFetch<{ logo: string }>(
            `https://api.coinpaprika.com/v1/coins/${match.id}`,
            { fetch },
          );
          const logoUrl = coinData?.logo ?? `https://static.coinpaprika.com/coin/${match.id}/logo.png`;
          logos[sym] = logoUrl;
          LOGO_CACHE.set(sym, logoUrl);
          LOGO_CACHE_TIME.set(sym, now);
        } else {
          logos[sym] = null;
          LOGO_CACHE.set(sym, "");
          LOGO_CACHE_TIME.set(sym, now);
        }
      } catch {
        logos[sym] = null;
      }
    }),
  );

  // Remaining symbols (beyond 20 limit) get null
  for (const sym of toFetch.slice(20)) {
    logos[sym] = null;
  }

  return NextResponse.json({ logos });
}
