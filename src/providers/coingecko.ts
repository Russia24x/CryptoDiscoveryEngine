/**
 * CoinGecko provider — free public endpoints (no key required).
 * Provides: market cap, FDV, circulating supply, price, volume.
 *
 * Note: CoinGecko's free public API may rate-limit. We keep requests
 * minimal and cache aggressively at the app layer.
 */
import {
  type DataProvider,
  type ProviderContext,
  type ProtocolSummary,
  type ProtocolDetail,
  safeJsonFetch,
} from "./types";

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number;
  circulating_supply: number;
  total_volume: number;
  price_change_percentage_24h?: number;
}

export const coingeckoProvider: DataProvider = {
  meta: {
    slug: "coingecko",
    name: "CoinGecko (Public)",
    baseUrl: "https://api.coingecko.com",
    authMode: "none",
    freeTier: true,
    tier: "free",
    categories: ["market", "supply"],
    priority: 20,
  },
  isAvailable(_: ProviderContext) {
    return true;
  },
  async listProtocols(ctx: ProviderContext): Promise<ProtocolSummary[]> {
    const data = await safeJsonFetch<CGMarket[]>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false",
      ctx,
    );
    if (!data) return [];
    return data.map<ProtocolSummary>((m) => ({
      symbol: (m.symbol || "").toUpperCase(),
      name: m.name,
      coingeckoId: m.id,
      mc: m.market_cap,
      fdv: m.fully_diluted_valuation ?? m.market_cap,
    }));
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
    const m = await safeJsonFetch<CGMarket[]>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" +
        encodeURIComponent(hit.coingeckoId || "") +
        "&sparkline=false",
      ctx,
    );
    const detail = m?.[0];
    return {
      ...hit,
      mc: detail?.market_cap ?? hit.mc,
      fdv: detail?.fully_diluted_valuation ?? hit.fdv,
      float: detail?.circulating_supply
        ? detail.circulating_supply * (detail.current_price || 0)
        : hit.mc,
    };
  },
};
