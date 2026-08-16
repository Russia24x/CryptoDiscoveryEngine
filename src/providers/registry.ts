/**
 * Provider registry — auto-registers built-in providers on first access.
 * Key-based providers (CMC, Messari, Nansen) can be registered here
 * later with no engine changes.
 */
import { defillamaProvider } from "./defillama";
import { coingeckoProvider } from "./coingecko";
import { binanceProvider } from "./binance";
import { registerProvider, listProviders as baseListProviders, type DataProvider } from "./types";

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registerProvider(binanceProvider);    // priority 5 — real-time
  registerProvider(defillamaProvider);   // priority 10 — TVL/fees/revenue
  registerProvider(coingeckoProvider);   // priority 20 — market data
  registered = true;
}

/** Ensure built-in providers are registered (idempotent). */
export function ensureProvidersRegistered() {
  ensureRegistered();
}

/** List providers, ensuring built-ins are registered first. */
export function listProviders(): DataProvider[] {
  ensureRegistered();
  return baseListProviders();
}

export type { DataProvider };
