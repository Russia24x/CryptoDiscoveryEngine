import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Decrypt a provider's API key for outbound use.
 * Returns the plaintext key, or null if not set or decryption fails.
 *
 * SECURITY: This function should ONLY be called server-side, never
 * exposed to the client. The returned key must be used immediately
 * for an outbound API call and never logged or returned in a response.
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
 * Usage in scan route or future provider adapters:
 *   const auth = await buildProviderAuth("coinmarketcap");
 *   const res = await fetch(url, { headers: auth.headers, ... });
 *   // or: const url = `${baseUrl}?${auth.queryParams}`;
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

const DEFAULT_PROVIDERS = [
  {
    slug: "defillama",
    name: "DeFiLlama",
    baseUrl: "https://api.llama.fi",
    authMode: "none",
    freeTier: true,
    tier: "free",
    priority: 10,
    categories: "tvl,fees,revenue",
  },
  {
    slug: "coingecko",
    name: "CoinGecko (Public)",
    baseUrl: "https://api.coingecko.com",
    authMode: "none",
    freeTier: true,
    tier: "free",
    priority: 20,
    categories: "market,supply",
  },
  {
    slug: "coinmarketcap",
    name: "CoinMarketCap",
    baseUrl: "https://pro-api.coinmarketcap.com",
    authMode: "header",
    keyHeader: "X-CMC-Pro-API-Key",
    freeTier: false,
    tier: "paid",
    priority: 30,
    categories: "market,supply",
    notes: "Paid — add your API key in Settings to enable.",
  },
  {
    slug: "messari",
    name: "Messari",
    baseUrl: "https://data.messari.io",
    authMode: "bearer",
    freeTier: false,
    tier: "paid",
    priority: 35,
    categories: "market,research",
    notes: "Paid — add your API key in Settings to enable.",
  },
];

async function ensureSeed() {
  const count = await db.provider.count();
  if (count === 0) {
    await db.provider.createMany({ data: DEFAULT_PROVIDERS });
  }
}

function sanitizeProvider(p: {
  id: string; slug: string; name: string; baseUrl: string;
  authMode: string; keyHeader: string | null; keyQuery: string | null;
  apiKey: string | null; freeTier: boolean; tier: string;
  priority: number; categories: string; notes: string | null;
  enabled: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id, slug: p.slug, name: p.name, baseUrl: p.baseUrl,
    authMode: p.authMode, keyHeader: p.keyHeader, keyQuery: p.keyQuery,
    hasKey: Boolean(p.apiKey),
    freeTier: p.freeTier, tier: p.tier, priority: p.priority,
    categories: p.categories, notes: p.notes, enabled: p.enabled,
  };
}

export async function GET() {
  try {
    await ensureSeed();
    const providers = await db.provider.findMany({ orderBy: { priority: "asc" } });
    return NextResponse.json({ providers: providers.map(sanitizeProvider) });
  } catch {
    return NextResponse.json({ providers: DEFAULT_PROVIDERS });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    await ensureSeed();
    const baseSlug = body.slug || (body.name || "provider").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "provider";
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const exists = await db.provider.findUnique({ where: { slug } });
      if (!exists) break;
      slug = `${baseSlug}-${suffix++}`;
    }
    const created = await db.provider.create({
      data: {
        slug, name: body.name || "Custom Provider", baseUrl: body.baseUrl || "",
        authMode: body.authMode || "none", keyHeader: body.keyHeader || null, keyQuery: body.keyQuery || null,
        apiKey: body.apiKey ? encrypt(body.apiKey) : null,
        freeTier: body.tier === "free", tier: body.tier || "free",
        priority: Number(body.priority) || 100, categories: body.categories || "",
        notes: body.notes || null, enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ provider: sanitizeProvider(created) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  try {
    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.apiKey !== undefined && body.apiKey !== "") data.apiKey = encrypt(body.apiKey);
    if (body.priority !== undefined) data.priority = Number(body.priority);
    const updated = await db.provider.update({ where: { slug: body.slug }, data });
    return NextResponse.json({ provider: sanitizeProvider(updated) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
