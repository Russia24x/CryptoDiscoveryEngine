/**
 * Provider registry — auto-registers built-in providers on first access.
 * Key-based providers (CMC, Messari, Nansen) can be registered here
 * later with no engine changes.
 */
import { defillamaProvider } from "./defillama";
import { coingeckoProvider } from "./coingecko";
import { registerProvider, listProviders as baseListProviders, type DataProvider } from "./types";

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registerProvider(defillamaProvider);
  registerProvider(coingeckoProvider);
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
