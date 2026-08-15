/**
 * DeFiLlama provider — free, key-less.
 * Endpoints: https://api.llama.fi and https://coins.llama.fi
 *
 * Provides: TVL, fees, revenue (via DefiLlama fees API), protocol list.
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
  chainTvls?: Record<string, number>;
}

interface LLFeesProtocol {
  id: string;
  name: string;
  symbol?: string;
  defillamaSlug?: string;
  fees_24h?: number;
  revenue_24h?: number;
  fees_7d?: number;
  revenue_7d?: number;
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
    const data = await safeJsonFetch<LLProtocol[]>(
      "https://api.llama.fi/protocols",
      ctx,
    );
    if (!data) return [];
    const fees = await safeJsonFetch<LLFeesProtocol[]>(
      "https://api.llama.fi/overview/fees?all=true",
      ctx,
    );
    const feesMap = new Map<string, LLFeesProtocol>();
    if (fees) for (const f of fees) feesMap.set((f.name || "").toLowerCase(), f);

    return data
      .filter((p) => p && p.symbol)
      .slice(0, 400)
      .map<ProtocolSummary>((p) => {
        const f = feesMap.get((p.name || "").toLowerCase());
        return {
          symbol: (p.symbol || "").toUpperCase(),
          name: p.name,
          defillamaSlug: p.id,
          category: p.category,
          chains: p.chains,
          tvl: p.tvl,
          fees24h: f?.fees_24h,
          revenue24h: f?.revenue_24h,
        };
      });
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
    // annualise 24h fees/revenue × 365 as a first-order estimate
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
