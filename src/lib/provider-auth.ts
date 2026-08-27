/**
 * Provider API-key resolution & outbound auth building.
 *
 * Moved out of src/app/api/providers/route.ts — App Router route modules
 * must only export HTTP handlers + route config. These helpers are part of
 * the "key-ready" provider architecture (RULES.md Rule 5) and will be used
 * by key-based provider adapters (CMC, Messari, …) when they are added.
 *
 * SECURITY: server-side only. The decrypted key must be used immediately for
 * an outbound API call and never logged or returned in a response.
 */

import { db } from "@/lib/db";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

/**
 * Decrypt a provider's API key for outbound use.
 * Returns the plaintext key, or null if not set or decryption fails.
 */
export async function getProviderApiKey(slug: string): Promise<string | null> {
  const provider = await db.provider.findUnique({
    where: { slug },
    select: { apiKey: true, authMode: true },
  });
  if (!provider?.apiKey) return null;

  // Handle both encrypted (new) and legacy plaintext (old) values.
  // isEncrypted is a heuristic — if the value looks like base64 and is
  // long enough to contain iv+ciphertext+tag, try decrypt.
  if (isEncrypted(provider.apiKey)) {
    return decrypt(provider.apiKey);
  }
  // Legacy plaintext value (pre-encryption) — return as-is.
  // This path will be removed once all values are migrated.
  return provider.apiKey;
}

/**
 * Build auth headers/query params for a provider request.
 * Decrypts the API key and places it in the correct location
 * based on the provider's authMode.
 *
 * Usage in provider adapters:
 *   const auth = await buildProviderAuth("coinmarketcap");
 *   const res = await fetch(url, { headers: auth.headers, ... });
 *   // or: `${baseUrl}?${new URLSearchParams(auth.queryParams)}`
 */
export async function buildProviderAuth(slug: string): Promise<{
  headers: Record<string, string>;
  queryParams: Record<string, string>;
}> {
  const provider = await db.provider.findUnique({
    where: { slug },
    select: { apiKey: true, authMode: true, keyHeader: true, keyQuery: true },
  });
  if (!provider) return { headers: {}, queryParams: {} };

  const headers: Record<string, string> = {};
  const queryParams: Record<string, string> = {};

  if (provider.authMode === "none" || !provider.apiKey) {
    return { headers, queryParams };
  }

  const key = await getProviderApiKey(slug);
  if (!key) return { headers, queryParams };

  switch (provider.authMode) {
    case "header":
      if (provider.keyHeader) headers[provider.keyHeader] = key;
      break;
    case "query":
      if (provider.keyQuery) queryParams[provider.keyQuery] = key;
      break;
    case "bearer":
      headers["Authorization"] = `Bearer ${key}`;
      break;
  }

  return { headers, queryParams };
}

/** Re-export for settings flows that need to encrypt a freshly entered key. */
export { encrypt };
