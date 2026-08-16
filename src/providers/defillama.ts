/**
 * DeFiLlama provider — free, key-less.
 * Endpoints: https://api.llama.fi
 *
 * Provides: TVL, fees, revenue, protocol list.
 *
 * API NOTES (verified 2026-08-15):
 * - /protocols returns an array of 8000+ protocols with TVL, symbol, category.
 * - /overview/fees?all=true returns a DICT (not array!) with:
 *     { totalDataChart, breakdown24h, protocols: [...2571 items] }
 *   Each protocol in fees has: total24h, annualized1y, total7d, etc.
 *   Field names are total24h (not fees_24h), annualized1y (not revenue_24h).
 */
import {
  type DataProvider,
  type ProviderContext,
  type ProtocolSummary,
  type ProtocolDetail,
  safeJsonFetch,
} from "./types";

interface LLProtocol {
  id: string;
  name: string;
  symbol: string;
  category: string;
  chains: string[];
  tvl?: number;
}

interface LLFeesProtocol {
  name: string;
  total24h?: number;      // total fees/revenue 24h (USD)
  annualized1y?: number;  // annualized fees (USD) — this is our PR/PC estimate
  total7d?: number;
}

interface LLFeesResponse {
  protocols?: LLFeesProtocol[];
  total24h?: number;
  // other fields: totalDataChart, breakdown24h, etc. — not needed here
}

export const defillamaProvider: DataProvider = {
  meta: {
    slug: "defillama",
    name: "DeFiLlama",
    baseUrl: "https://api.llama.fi",
    authMode: "none",
    freeTier: true,
    tier: "free",
    categories: ["tvl", "fees", "revenue"],
    priority: 10,
  },
  isAvailable(_: ProviderContext) {
    return true; // key-less
  },
  async listProtocols(ctx: ProviderContext): Promise<ProtocolSummary[]> {
    // 1. Fetch protocol list (array of 8000+ with TVL)
    const protocols = await safeJsonFetch<LLProtocol[]>(
      "https://api.llama.fi/protocols",
      ctx,
    );
    if (!protocols) return [];

    // 2. Fetch fees data (DICT with .protocols array inside)
    const feesData = await safeJsonFetch<LLFeesResponse>(
      "https://api.llama.fi/overview/fees?all=true",
      ctx,
    );
    const feesProtocols = feesData?.protocols ?? [];
    const feesMap = new Map<string, LLFeesProtocol>();
    for (const f of feesProtocols) {
      feesMap.set((f.name || "").toLowerCase(), f);
    }

    // 3. Merge: join protocols (TVL) with fees (annualized revenue)
    return protocols
      .filter((p) => p && p.symbol && p.tvl)
      .slice(0, 400) // keep top 400 by TVL (API returns sorted)
      .map<ProtocolSummary>((p) => {
        const f = feesMap.get((p.name || "").toLowerCase());
        const annualRev = f?.annualized1y ?? 0;
        const dailyFees = f?.total24h ?? 0;
        return {
          symbol: (p.symbol || "").toUpperCase(),
          name: p.name,
          defillamaSlug: p.id,
          category: p.category,
          chains: p.chains,
          tvl: p.tvl,
          fees24h: dailyFees,      // daily fees (USD)
          revenue24h: annualRev / 365, // daily revenue from annualized (USD)
        };
      })
      // Only keep protocols that have EITHER TVL OR fees data
      .filter((p) => (p.tvl ?? 0) > 0 || (p.fees24h ?? 0) > 0);
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
    // Use annualized revenue as PR (Protocol Revenue)
    // Fees (24h × 365) as PC (Protocol Capture — fees captured by protocol)
    const pr = (hit.revenue24h ?? 0) * 365;
    const pc = (hit.fees24h ?? 0) * 365;
    return {
      ...hit,
      gea: (hit.fees24h ?? 0) * 365,
      pr,
      pc,
      tc: 0, // tokenholder capture unknown for most — left to other providers/estimates
      accrualKind: "fee",
    };
  },
};
