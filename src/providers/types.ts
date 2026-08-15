/**
 * CryptoSieve — Data Provider abstraction.
 *
 * Free-first, key-ready. Every provider implements the same interface,
 * so key-based providers (CMC, Messari, Nansen) plug in with only an
 * adapter + an API-key field change.
 */

export interface ProviderMeta {
  slug: string;
  name: string;
  baseUrl: string;
  authMode: "none" | "header" | "query" | "bearer";
  keyHeader?: string;
  keyQuery?: string;
  freeTier: boolean;
  tier: "free" | "paid";
  categories: string[]; // "tvl" | "fees" | "revenue" | "market" | "supply"
  priority: number;
}

export interface ProviderContext {
  apiKey?: string;
  fetch?: typeof fetch;
}

export interface ProtocolSummary {
  symbol: string;
  name: string;
  defillamaSlug?: string;
  coingeckoId?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  fees24h?: number;
  revenue24h?: number;
  mc?: number;
  fdv?: number;
}

export interface ProtocolDetail extends ProtocolSummary {
  // value-accrual chain (annualised usd)
  gea?: number;
  pr?: number; // protocol revenue
  pc?: number; // protocol capture
  tc?: number; // tokenholder capture
  // supply
  buyback?: number;
  burn?: number;
  unlock12m?: number;
  emission12m?: number;
  float?: number;
  accrualKind?: "fee" | "buyback_burn" | "staking" | "revenue_share";
}

export interface DataProvider {
  meta: ProviderMeta;
  isAvailable(ctx: ProviderContext): boolean;
  listProtocols(ctx: ProviderContext): Promise<ProtocolSummary[]>;
  getProtocol(symbol: string, ctx: ProviderContext): Promise<ProtocolDetail | null>;
}

// ─── Registry ─────────────────────────────────────────────────────

const registry = new Map<string, DataProvider>();

export function registerProvider(p: DataProvider) {
  registry.set(p.meta.slug, p);
}

export function getProvider(slug: string): DataProvider | undefined {
  return registry.get(slug);
}

export function listProviders(): DataProvider[] {
  return Array.from(registry.values()).sort((a, b) => a.meta.priority - b.meta.priority);
}

export function availableProviders(ctx: ProviderContext): DataProvider[] {
  return listProviders().filter((p) => p.isAvailable(ctx));
}

// ─── Fetch helper that respects the gateway XTransformPort rule ────
// NOTE: when calling external public APIs from the backend we use absolute
// https URLs (this is server-side, not browser). The XTransformPort rule
// only applies to in-cluster relative requests.

export async function safeJsonFetch<T = unknown>(
  url: string,
  ctx: ProviderContext,
  init?: RequestInit,
  timeoutMs = 12000,
): Promise<T | null> {
  const f = ctx.fetch ?? fetch;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[provider] ${res.status} ${res.statusText} ← ${url}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[provider] fetch failed ← ${url}: ${msg}`);
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}
