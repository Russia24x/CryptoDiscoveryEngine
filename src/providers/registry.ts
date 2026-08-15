/**
 * Provider registry — auto-registers built-in providers.
 * Key-based providers (CMC, Messari, Nansen) can be registered here
 * later with no engine changes.
 */
import { defillamaProvider } from "./defillama";
import { coingeckoProvider } from "./coingecko";
import { registerProvider, listProviders, type DataProvider } from "./types";

let registered = false;
export function ensureProvidersRegistered() {
  if (registered) return;
  registerProvider(defillamaProvider);
  registerProvider(coingeckoProvider);
  registered = true;
}

export { listProviders };
export type { DataProvider };
